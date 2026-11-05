import { createClient } from '@supabase/supabase-js';
import { authorizedWorker, processJobs, type DeliveryJob } from './worker.ts';

Deno.serve(async request => {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Response.json({ error: 'Worker configuration unavailable' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!await authorizedWorker(request.headers.get('Authorization'), async secret => {
    const { data, error } = await db.rpc('verify_admin_notification_worker', { p_secret: secret });
    return !error && data === true;
  })) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data, error } = await db.rpc('claim_admin_notification_deliveries', { p_limit: 25 });
    if (error) throw error;
    const jobs = (data ?? []) as DeliveryJob[];
    const summary: Record<string, number> = {};
    for (const group of [jobs.filter(job => !job.receipt_id), jobs.filter(job => job.receipt_id)]) {
      const results = await processJobs(group, fetch, Deno.env.get('EXPO_PUSH_ACCESS_TOKEN'));
      for (let index = 0; index < group.length; index++) {
        const job = group[index], result = results[index];
        // shortcut: a crash after Expo accepts a send can cause a retry; device tags collapse the same incident.
        const { error: finishError } = await db.rpc('finish_admin_notification_delivery', {
          p_id: job.id, p_lease_id: job.lease_id, p_result: result,
        });
        if (finishError) throw finishError;
        summary[result.outcome] = (summary[result.outcome] ?? 0) + 1;
        if (result.outcome === 'failed') console.error('Notification delivery configuration failure', result.error);
      }
    }
    return Response.json({ claimed: jobs.length, outcomes: summary });
  } catch {
    console.error('Notification worker failed; uncompleted leases will be retried');
    return Response.json({ error: 'Notification processing failed' }, { status: 500 });
  }
});
