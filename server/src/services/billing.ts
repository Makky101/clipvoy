import Stripe from 'stripe';
import { AppError } from '../utils/appError.js';
import { getAccount, getAdmin, type CreditAccount } from './accounts.js';

export type PlanId = 'weekly' | 'monthly';
export interface Plan {
  id: PlanId;
  name: string;
  credits: number;
  amount: number;
  currency: string;
  interval: 'week' | 'month';
  ready: boolean;
}

let stripe: Stripe | undefined;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('YOUR_')) throw new AppError('Payments are not configured yet.', 503);
  return stripe ??= new Stripe(key);
}

export function priceId(plan: PlanId): string | undefined {
  const id = process.env[plan === 'weekly' ? 'STRIPE_WEEKLY_PRICE_ID' : 'STRIPE_MONTHLY_PRICE_ID'];
  return id && !id.includes('YOUR_') ? id : undefined;
}

function creditCount(plan: PlanId): number {
  const credits = Number(process.env[plan === 'weekly' ? 'WEEKLY_CREDITS' : 'MONTHLY_CREDITS'] ?? (plan === 'weekly' ? 10 : 40));
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 10000) throw new AppError('Invalid subscription credit configuration.', 503);
  return credits;
}

export function clientUrl(): string {
  const url = process.env.CLIENT_URL ?? 'http://localhost:5173';
  return new URL(url).origin;
}

let cachedPlans: { until: number; plans: Plan[] } | undefined;
export async function getPlans(): Promise<Plan[]> {
  if (cachedPlans && cachedPlans.until > Date.now()) return cachedPlans.plans;
  const plans: Plan[] = [];
  for (const id of ['weekly', 'monthly'] as const) {
    const plan: Plan = { id, name: id === 'weekly' ? 'Weekly' : 'Monthly', credits: creditCount(id),
      amount: id === 'weekly' ? 900 : 2900, currency: 'usd', interval: id === 'weekly' ? 'week' : 'month', ready: false };
    if (priceId(id) && process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('YOUR_') &&
        process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.includes('YOUR_')) {
      const price = await getStripe().prices.retrieve(priceId(id)!);
      if (!price.active || price.currency !== 'usd' || price.type !== 'recurring' || price.recurring?.interval !== plan.interval ||
          price.recurring.interval_count !== 1 || price.recurring.usage_type !== 'licensed' ||
          price.billing_scheme !== 'per_unit' || !price.unit_amount || price.unit_amount < 1) {
        throw new AppError(`Configure a fixed USD recurring ${plan.interval} price for the ${id} plan.`, 503);
      }
      plan.amount = price.unit_amount;
      plan.currency = price.currency;
      plan.ready = true;
    }
    plans.push(plan);
  }
  cachedPlans = { until: Date.now() + 60000, plans };
  return plans;
}

export async function getSubscription(customer: string | null) {
  if (!customer || !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('YOUR_')) return null;
  const subscriptions = await getStripe().subscriptions.list({ customer, status: 'all', limit: 100 });
  return subscriptions.data.find((sub) => sub.status !== 'canceled' && sub.status !== 'incomplete_expired') ?? null;
}

async function ensureCustomer(account: CreditAccount, email?: string): Promise<string> {
  if (account.stripe_customer_id) return account.stripe_customer_id;
  const customer = await getStripe().customers.create({ email, metadata: { user_id: account.user_id } },
    { idempotencyKey: `clipvoy-customer-${account.user_id}` });
  const { error } = await getAdmin().from('credit_accounts').update({ stripe_customer_id: customer.id }).eq('user_id', account.user_id);
  if (error) throw new AppError('Unable to save your billing account. Please try again.', 503);
  return customer.id;
}

export async function createCheckout(userId: string, email: string | undefined, requested: PlanId): Promise<string> {
  const plans = await getPlans();
  if (!plans.find((plan) => plan.id === requested)?.ready) throw new AppError('This subscription is not available yet.', 503);
  const initial = await getAccount(userId);
  const customer = await ensureCustomer(initial, email);
  if (await getSubscription(customer)) throw new AppError('You already have a subscription. Use Manage subscription to update or cancel it.', 409);
  const { data, error } = await getAdmin().rpc('lock_credit_checkout', { p_user: userId, p_plan: requested });
  if (error || !data) throw new AppError('Unable to prepare checkout. Please try again.', 503);
  const account = data as CreditAccount;
  // A pending session may have completed while this request waited for the
  // account lock. Recheck after taking the current checkout generation.
  if (await getSubscription(customer)) throw new AppError('You already have a subscription. Use Manage subscription to cancel it.', 409);
  if (account.checkout_session_id) {
    const pending = await getStripe().checkout.sessions.retrieve(account.checkout_session_id);
    if (pending.status === 'open' && account.checkout_plan === requested && pending.url) return pending.url;
    if (pending.status === 'complete') throw new AppError('Payment is being confirmed. Please refresh your credits shortly.', 409);
    // Expiring the old session prevents it being paid after switching plans.
    if (pending.status === 'open') await getStripe().checkout.sessions.expire(pending.id);
    // Clear only the generation we inspected. A concurrent checkout remains protected.
    const { error: clearError } = await getAdmin().from('credit_accounts').update({ checkout_until: null, checkout_session_id: null })
      .eq('user_id', userId).eq('checkout_version', account.checkout_version);
    if (clearError) throw new AppError('Unable to reset expired checkout.', 503);
    return createCheckout(userId, email, requested);
  }
  const chosen = plans.find((plan) => plan.id === account.checkout_plan)!;
  if (!chosen?.ready) throw new AppError('This subscription is not available yet.', 503);
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription', customer, client_reference_id: userId,
    // This integration uses standard Stripe Billing, regardless of the
    // account's default Managed Payments (merchant-of-record) setting.
    managed_payments: { enabled: false },
    line_items: [{ price: priceId(chosen.id), quantity: 1 }],
    subscription_data: { metadata: { user_id: userId, plan: chosen.id, credits: String(chosen.credits) } },
    success_url: `${clientUrl()}/?billing=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${clientUrl()}/?billing=cancelled`,
    // Stripe's default 24-hour expiry keeps the same creation parameters on retry.
  // v2 adds the explicit Managed Payments setting. Keep retries stable, but
  // never reuse a pre-v2 key with the changed Checkout parameters.
  }, { idempotencyKey: `clipvoy-checkout-v2-${userId}-${account.checkout_version}` });
  const { error: saveError } = await getAdmin().from('credit_accounts').update({ checkout_session_id: session.id })
    .eq('user_id', userId).eq('checkout_version', account.checkout_version);
  if (saveError || !session.url) throw new AppError('Unable to open checkout. Please try again.', 503);
  return session.url;
}

export async function grantPaidInvoice(invoiceId: string): Promise<void> {
  // Retrieve current SDK-shaped objects, rather than trusting a webhook API version.
  const invoice = await getStripe().invoices.retrieve(invoiceId);
  if (invoice.status !== 'paid' || invoice.amount_paid <= 0 ||
      !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')) return;
  const ref = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof ref === 'string' ? ref : ref?.id;
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.user_id;
  if (!userId) return; // Unrelated subscriptions in the same Stripe account.
  const account = await getAccount(userId);
  const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (account.stripe_customer_id !== customer) throw new Error('Invoice customer does not match its account.');
  const lines = await getStripe().invoices.listLineItems(invoiceId, { limit: 100 });
  const matching = (await getPlans()).filter((plan) => lines.data.some((line) =>
    line.pricing?.price_details?.price === priceId(plan.id) && line.quantity === 1 &&
    !line.parent?.subscription_item_details?.proration));
  if (matching.length !== 1) throw new Error('Invoice does not match exactly one configured credit plan.');
  const plan = matching[0];
  const credits = subscription.metadata.plan === plan.id ? Number(subscription.metadata.credits) : plan.credits;
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 10000) throw new Error('Invalid subscription credit allowance.');
  const { error } = await getAdmin().rpc('grant_invoice_credits', {
    p_invoice: invoice.id, p_user: userId, p_subscription: subscription.id, p_plan: plan.id, p_credits: credits,
  });
  if (error) throw new Error(`Invoice credit grant failed: ${error.message}`);
}
