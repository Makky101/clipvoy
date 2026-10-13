import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { accountRequest, type AccountBalance } from '../services/accountApi';
import { BillingContext } from '../services/billingContext';

export function BillingProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [account, setAccount] = useState<AccountBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lifecycle = useRef({ requestId: 0, active: true });
  const refresh = useCallback(async () => {
    const state = lifecycle.current;
    if (!state.active) return;
    const current = ++state.requestId;
    try {
      const next = await accountRequest<AccountBalance>('/account');
      if (!state.active || current !== state.requestId) return;
      setAccount(next);
      setError(null);
    } catch (err) {
      if (!state.active || current !== state.requestId) return;
      setError(err instanceof Error ? err.message : 'Unable to load credits.');
    } finally { if (state.active && current === state.requestId) setLoading(false); }
  }, []);
  useEffect(() => {
    const state = lifecycle.current;
    state.active = true;
    queueMicrotask(() => void refresh());
    const timer = window.setInterval(() => void refresh(), 15000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { state.active = false; ++state.requestId; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return <BillingContext.Provider value={{ userId, account, error, loading, refresh }}>{children}</BillingContext.Provider>;
}

