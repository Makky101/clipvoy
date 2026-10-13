import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { AppError } from '../utils/appError.js';

let admin: SupabaseClient | undefined;
export function getAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || url.includes('YOUR_') || key.includes('YOUR_')) {
    throw new AppError('Account credits are not configured yet.', 503);
  }
  return admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const requireAccount: RequestHandler = (req, res, next) => {
  void (async () => {
    const match = /^Bearer (\S+)$/.exec(req.get('Authorization') ?? '');
    if (!match) throw new AppError('Please sign in to continue.', 401);
    const { data, error } = await getAdmin().auth.getUser(match[1]);
    if (error || !data.user || data.user.is_anonymous) throw new AppError('Your session has expired. Please sign in again.', 401);
    res.locals.userId = data.user.id;
    res.locals.email = data.user.email;
    next();
  })().catch(next);
};

export interface CreditAccount {
  user_id: string;
  credits: number;
  stripe_customer_id: string | null;
  checkout_version: number;
  checkout_until: string | null;
  checkout_session_id: string | null;
  checkout_plan: string | null;
}

export interface CreditJob {
  id: string;
  user_id: string;
  upload_key: string;
  original_name: string;
  state: 'reserved' | 'queued' | 'completed' | 'refunded';
  clips: unknown;
}

export async function getAccount(userId: string): Promise<CreditAccount> {
  const { data, error } = await getAdmin().from('credit_accounts').select('*').eq('user_id', userId).single();
  if (error || !data) throw new AppError('Unable to load credits. Check the Supabase credits migration.', 503);
  return data as CreditAccount;
}

export async function reserveCredit(userId: string, key: string, name: string): Promise<CreditJob> {
  const { data, error } = await getAdmin().rpc('reserve_video_credit', { p_user: userId, p_key: key, p_name: name });
  if (error?.message.includes('NO_CREDITS')) throw new AppError('You have no credits left. Choose a subscription to continue.', 402);
  if (error || !data) throw new AppError('Unable to reserve a credit. Please try again.', 503);
  return data as CreditJob;
}

export async function settleCredit(jobId: string, failed: boolean, clips: unknown = null): Promise<void> {
  const { error } = await getAdmin().rpc('settle_video_credit', { p_job: jobId, p_failed: failed, p_clips: clips });
  if (error) throw new Error(`Credit settlement failed: ${error.message}`);
}

export async function getCreditJob(jobId: string, userId: string): Promise<CreditJob> {
  const { data, error } = await getAdmin().from('credit_jobs').select('*').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new AppError('Unable to load processing status.', 503);
  if (!data) throw new AppError('Job not found.', 404);
  return data as CreditJob;
}
