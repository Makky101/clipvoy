import { useEffect, useState, type ReactNode } from 'react';
import { accountRequest, type BillingPlan } from '../services/accountApi';
import { useBilling } from '../services/billingContext';

const previewPlans: BillingPlan[] = [
  { id: 'weekly', name: 'Weekly', amount: 900, currency: 'usd', credits: 10, interval: 'week', ready: false },
  { id: 'monthly', name: 'Monthly', amount: 2900, currency: 'usd', credits: 40, interval: 'month', ready: false },
];

export function BillingSection({ accountBar }: { accountBar?: ReactNode }) {
  const { account, error, loading, refresh } = useBilling();
  const query = new URLSearchParams(window.location.search);
  const sessionId = query.get('session_id');
  const returned = query.get('billing');
  const [pending, setPending] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(() => returned === 'success' && sessionId ? 'Confirming your payment. Credits will appear shortly.' : null);
  const [showPlans, setShowPlans] = useState<boolean | null>(null);

  useEffect(() => {
    if (returned !== 'success' || !sessionId) return;
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    const check = async () => {
      try {
        const result = await accountRequest<{ credited: boolean }>(`/checkout/${encodeURIComponent(sessionId)}`);
        if (!active) return;
        if (result.credited) {
          await refresh();
          if (!active) return;
          setConfirmation('Payment confirmed. Your credits are ready to use.');
          const url = new URL(window.location.href);
          url.searchParams.delete('billing'); url.searchParams.delete('session_id');
          window.history.replaceState(null, '', url);
          return;
        }
      } catch (err) {
        if (!active) return;
        setPaymentError(err instanceof Error ? err.message : 'Unable to confirm payment.');
      }
      if (++attempts < 20) timer = window.setTimeout(() => void check(), 3000);
      else setConfirmation('Payment confirmation is taking longer than expected. Refresh this page shortly to check your credits.');
    };
    void check();
    return () => { active = false; if (timer !== undefined) window.clearTimeout(timer); };
  }, [returned, sessionId, refresh]);

  async function openBilling(plan?: BillingPlan['id']) {
    setPending(plan ?? 'portal'); setPaymentError(null);
    try {
      const { url } = await accountRequest<{ url: string }>(plan ? '/checkout' : '/portal', plan ? { plan } : {});
      window.location.assign(url);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Unable to open payment page.');
      setPending(null);
    }
  }

  const outOfCredits = account?.credits === 0;
  const expanded = showPlans ?? (outOfCredits || Boolean(confirmation) || returned === 'cancelled');
  return <section className="billing-section" aria-labelledby="credits-title">
    <div className="credits-heading">
      <div>
        <h2 id="credits-title" aria-live="polite">{loading ? 'Loading credits…' : account ? `${account.credits} ${account.credits === 1 ? 'credit' : 'credits'} remaining` : 'Credits unavailable'}</h2>
        <p className="muted">1 credit per video. Failed processing is refunded.</p>
      </div>
      <div className="billing-actions">
        {account?.hasCustomer && <button className="close-button" disabled={Boolean(pending)} onClick={() => void openBilling()}>Manage subscription</button>}
        <button className="close-button" onClick={() => setShowPlans(!expanded)} aria-expanded={expanded} aria-controls="subscription-plans">{expanded ? 'Hide plans' : 'View plans'}</button>
        {accountBar}
      </div>
    </div>
    {error && <div className="billing-error" role="alert"><span>{error === 'Failed to fetch' ? 'Unable to connect to your account. Please try again.' : error}</span><button className="close-button" onClick={() => void refresh()}>Retry</button></div>}
    {outOfCredits && <p className="credit-notice" role="status">You have used all your credits. Choose a subscription below to process more videos.</p>}
    {confirmation && <p className="credit-notice" role="status">{confirmation}</p>}
    {returned === 'cancelled' && <p className="muted" role="status">Checkout was cancelled. You have not been charged. You can reopen your pending checkout below.</p>}
    {paymentError && <p className="error" role="alert">{paymentError}</p>}
    {expanded && <div id="subscription-plans" className="subscription-plans">
      {(account?.plans ?? previewPlans).map((plan) => <article className="subscription-plan" key={plan.id}>
        <h3>{plan.name}</h3>
        <p className="plan-price">{new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency }).format(plan.amount / 100)}<span> / {plan.interval}</span></p>
        <p>{plan.credits} credits every {plan.interval}. Unused credits carry over.</p>
        <button disabled={!plan.ready || !account || Boolean(pending) || Boolean(account.subscription)} onClick={() => void openBilling(plan.id)}>
          {pending === plan.id ? 'Opening checkout…' : account?.subscription ? 'Subscription already active' : plan.ready ? `Subscribe ${plan.id}` : 'Available after payment setup'}
        </button>
      </article>)}
      <p className="plan-terms">Subscriptions renew automatically until cancelled. Cancel through Manage subscription; cancellation stops future renewals and your remaining credits stay available. Your account starts with 3 free credits.</p>
      {account?.subscription && <p className="plan-terms">Subscription: {account.subscription.status.replaceAll('_', ' ')}.{account.subscription.renewsAt && ` ${account.subscription.cancelAtPeriodEnd ? 'Ends' : 'Next billing date'}: ${new Date(account.subscription.renewsAt * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}.`}</p>}
    </div>}
  </section>;
}
