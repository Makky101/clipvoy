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
  return <section className="border-b border-slate-300 py-5" aria-labelledby="credits-title">
    <div className="flex flex-wrap items-center justify-between gap-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight">
      <div>
        <h2 id="credits-title" aria-live="polite">{loading ? 'Loading credits…' : account ? `${account.credits} ${account.credits === 1 ? 'credit' : 'credits'} remaining` : 'Credits unavailable'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#52677c]">1 credit per video. Failed processing is refunded.</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 lg:w-auto">
        {account?.hasCustomer && <button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50" disabled={Boolean(pending)} onClick={() => void openBilling()}>Manage subscription</button>}
        <button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50" onClick={() => setShowPlans(!expanded)} aria-expanded={expanded} aria-controls="subscription-plans">{expanded ? 'Hide plans' : 'View plans'}</button>
        {accountBar}
      </div>
    </div>
    {error && <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[#52677c] wrap-anywhere" role="alert"><span>{error === 'Failed to fetch' ? 'Unable to connect to your account. Please try again.' : error}</span><button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50" onClick={() => void refresh()}>Retry</button></div>}
    {outOfCredits && <p className="mt-4 rounded-lg border-l-2 border-[#b84319] bg-white px-4 py-3 text-sm leading-relaxed" role="status">You have used all your credits. Choose a subscription below to process more videos.</p>}
    {confirmation && <p className="mt-4 rounded-lg border-l-2 border-[#b84319] bg-white px-4 py-3 text-sm leading-relaxed" role="status">{confirmation}</p>}
    {returned === 'cancelled' && <p className="mt-2 text-sm leading-relaxed text-[#52677c]" role="status">Checkout was cancelled. You have not been charged. You can reopen your pending checkout below.</p>}
    {paymentError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 wrap-anywhere" role="alert">{paymentError}</p>}
    {expanded && <div id="subscription-plans" className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
      {(account?.plans ?? previewPlans).map((plan) => <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 [&>h3]:text-xl [&>h3]:font-semibold [&>p:not(:first-of-type)]:mb-6 [&>p:not(:first-of-type)]:text-sm [&>p:not(:first-of-type)]:leading-relaxed [&>p:not(:first-of-type)]:text-[#52677c]" key={plan.id}>
        <h3>{plan.name}</h3>
        <p className="my-4 text-4xl font-semibold tracking-tight [&>span]:text-base [&>span]:font-normal [&>span]:text-[#52677c]">{new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency }).format(plan.amount / 100)}<span> / {plan.interval}</span></p>
        <p>{plan.credits} credits every {plan.interval}. Unused credits carry over.</p>
        <button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] bg-[#b84319] text-white hover:enabled:bg-[#963613] w-full" disabled={!plan.ready || !account || Boolean(pending) || Boolean(account.subscription)} onClick={() => void openBilling(plan.id)}>
          {pending === plan.id ? 'Opening checkout…' : account?.subscription ? 'Subscription already active' : plan.ready ? `Subscribe ${plan.id}` : 'Available after payment setup'}
        </button>
      </article>)}
      <p className="col-span-full text-sm leading-relaxed text-[#52677c]">Subscriptions renew automatically until cancelled. Cancel through Manage subscription; cancellation stops future renewals and your remaining credits stay available. Your account starts with 3 free credits.</p>
      {account?.subscription && <p className="col-span-full text-sm leading-relaxed text-[#52677c]">Subscription: {account.subscription.status.replaceAll('_', ' ')}.{account.subscription.renewsAt && ` ${account.subscription.cancelAtPeriodEnd ? 'Ends' : 'Next billing date'}: ${new Date(account.subscription.renewsAt * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}.`}</p>}
    </div>}
  </section>;
}
