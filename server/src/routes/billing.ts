import { Router, type Request, type Response, type NextFunction } from 'express';
import { getAccount, getAdmin, requireAccount } from '../services/accounts.js';
import { clientUrl, createCheckout, getPlans, getStripe, getSubscription, grantPaidInvoice } from '../services/billing.js';
import { AppError } from '../utils/appError.js';

export const billingRouter = Router();
billingRouter.use(requireAccount);
billingRouter.get('/account', (_req, res, next) => {
  void (async () => {
    const account = await getAccount(res.locals.userId);
    const subscription = await getSubscription(account.stripe_customer_id);
    res.json({ credits: account.credits, plans: await getPlans(), hasCustomer: Boolean(account.stripe_customer_id),
      subscription: subscription ? {
        status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end,
        renewsAt: subscription.items.data[0]?.current_period_end ?? null,
      } : null });
  })().catch(next);
});
billingRouter.post('/checkout', (req, res, next) => {
  void (async () => {
    const plan = req.body?.plan;
    if (plan !== 'weekly' && plan !== 'monthly') throw new AppError('Choose a weekly or monthly plan.', 400);
    res.json({ url: await createCheckout(res.locals.userId, res.locals.email, plan) });
  })().catch(next);
});
billingRouter.get('/checkout/:id', (req, res, next) => {
  void (async () => {
    const session = await getStripe().checkout.sessions.retrieve(req.params.id);
    const account = await getAccount(res.locals.userId);
    if (session.client_reference_id !== res.locals.userId || session.customer !== account.stripe_customer_id) {
      throw new AppError('Checkout not found.', 404);
    }
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    const result = invoiceId ? await getAdmin().from('credit_invoices').select('invoice_id')
      .eq('invoice_id', invoiceId).eq('user_id', res.locals.userId).maybeSingle() : null;
    if (result?.error) throw new AppError('Unable to confirm credit delivery.', 503);
    res.json({ credited: session.status === 'complete' && session.payment_status === 'paid' && Boolean(result?.data) });
  })().catch(next);
});
billingRouter.post('/portal', (_req, res, next) => {
  void (async () => {
    const account = await getAccount(res.locals.userId);
    if (!account.stripe_customer_id) throw new AppError('Choose a subscription first.', 400);
    const portal = await getStripe().billingPortal.sessions.create({ customer: account.stripe_customer_id, return_url: `${clientUrl()}/` });
    res.json({ url: portal.url });
  })().catch(next);
});

export function stripeWebhook(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const signature = req.get('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || secret.includes('YOUR_')) throw new AppError('Stripe webhook is not configured.', 503);
    if (!signature || !Buffer.isBuffer(req.body)) throw new AppError('Invalid webhook payload.', 400);
    let event;
    try { event = getStripe().webhooks.constructEvent(req.body, signature, secret); }
    catch { throw new AppError('Invalid Stripe webhook signature.', 400); }
    if (event.type === 'invoice.paid') await grantPaidInvoice(event.data.object.id);
    res.json({ received: true });
  })().catch(next);
}
