import { supabase } from './supabase';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Please sign in to continue.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Your session has expired. Please sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export async function accountRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}/api/billing${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Unable to load your account. Please try again.');
  return data as T;
}

export interface BillingPlan {
  id: 'weekly' | 'monthly';
  name: string;
  credits: number;
  amount: number;
  currency: string;
  interval: 'week' | 'month';
  ready: boolean;
}

export interface AccountBalance {
  credits: number;
  plans: BillingPlan[];
  hasCustomer: boolean;
  subscription: { status: string; cancelAtPeriodEnd: boolean; renewsAt: number | null } | null;
}
