import { getVideoQueue } from '../queue/videoQueue.js';
import { getAdmin, settleCredit, type CreditJob } from './accounts.js';

// A durable database reservation is the outbox. Redis outages must neither
// lose a charged job nor refund work that Redis may already have accepted.
export async function dispatchJob(job: CreditJob): Promise<void> {
  if (job.state === 'completed' || job.state === 'refunded') return;
  const queued = await getVideoQueue().add('process-video', {
    key: job.upload_key, originalName: job.original_name, userId: job.user_id,
  }, { jobId: job.id });
  const state = await queued.getState();
  if (state === 'failed') { await settleCredit(job.id, true); return; }
  if (state === 'completed') { await settleCredit(job.id, false, queued.returnvalue?.clips ?? []); return; }
  const { error } = await getAdmin().from('credit_jobs').update({ state: 'queued', updated_at: new Date().toISOString() })
    .eq('id', job.id).in('state', ['reserved', 'queued']);
  if (error) throw new Error(error.message);
}

export function startCreditDispatcher(): () => void {
  let running = false;
  const tick = async () => {
    if (running || !process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY.includes('YOUR_')) return;
    running = true;
    try {
      const { data, error } = await getAdmin().from('credit_jobs').select('*')
        .in('state', ['reserved', 'queued']).order('updated_at').limit(100);
      if (error) throw new Error(error.message);
      for (const job of data ?? []) await dispatchJob(job as CreditJob);
    } catch (error) {
      console.error('Credit job dispatch will retry:', error instanceof Error ? error.message : 'unknown');
    } finally { running = false; }
  };
  const timer = setInterval(() => void tick(), 15000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
