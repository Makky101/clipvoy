import { createContext, useContext } from 'react';
import type { AccountBalance } from './accountApi';

export interface BillingState {
  userId: string;
  account: AccountBalance | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}
export const BillingContext = createContext<BillingState | null>(null);
export function useBilling(): BillingState {
  const context = useContext(BillingContext);
  if (!context) throw new Error('BillingProvider is required.');
  return context;
}
