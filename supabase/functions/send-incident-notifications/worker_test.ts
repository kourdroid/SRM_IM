import { authorizedWorker, buildMessage, interpretExpoResult, processJobs, type DeliveryJob } from './worker.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
const job: DeliveryJob = {
  id: 'job', lease_id: 'lease', notification_id: 'alert', recipient_id: 'admin', incident_id: 'incident',
  token: 'ExpoPushToken[abcdefghij]', kind: 'initial', receipt_id: null,
  type: 'MT', incident_type: 'Rupture', depart_hta: 'Départ A', commune: 'Commune A', village: 'Village B',
  reported_at: '2026-10-26T12:00:00Z',
};

Deno.test('urgent MT payload contains routing, stable replacement tag and Casablanca report time', () => {
  const message = buildMessage(job);
  assert(message.title === 'NOUVEL INCIDENT · MT');
  assert(message.body.includes('Départ A') && message.body.includes('Commune A') && message.body.includes('13:00'));
  assert(message.channelId === 'incidents-urgent-v1' && message.sound === 'intervx_alert.wav');
  assert(message.tag === buildMessage({ ...job, kind: 'reminder' }).tag);
  assert(message.data.recipient_id === 'admin' && message.data.incident_id === 'incident');
  assert(!buildMessage({ ...job, type: 'BT' }).body.includes('Départ A'));
});

Deno.test('provider acceptance is distinct from enqueue ticket and invalid tokens are removed', () => {
  assert(interpretExpoResult({ status: 'ok', id: 'receipt' }, false).outcome === 'ticket');
  assert(interpretExpoResult({ status: 'ok' }, true).outcome === 'provider_accepted');
  assert(interpretExpoResult({ status: 'ok' }, false).outcome === 'retry');
  assert(interpretExpoResult({ status: 'error', details: { error: 'DeviceNotRegistered' } }, true).outcome === 'invalid_token');
  assert(interpretExpoResult({ status: 'error', details: { error: 'InvalidCredentials' } }, false).outcome === 'failed');
  assert(interpretExpoResult(undefined, true).outcome === 'retry');
});

Deno.test('send batches preserve provider ticket ordering without creating client duplicates', async () => {
  let calls = 0;
  const mock = ((_: unknown, options: RequestInit) => {
    calls++;
    const messages = JSON.parse(options.body as string);
    assert(messages.length === 2 && messages[0].data.notification_id === 'alert');
    return Promise.resolve(Response.json({ data: [{ status: 'ok', id: 'r1' }, { status: 'error', details: { error: 'MessageRateExceeded' } }] }));
  }) as typeof fetch;
  const results = await processJobs([job, { ...job, id: 'job2' }], mock);
  assert(calls === 1 && results[0].receipt_id === 'r1' && results[1].outcome === 'retry');
});

Deno.test('receipt batches map IDs and missing receipts retry instead of claiming delivery', async () => {
  const mock = (() => Promise.resolve(Response.json({ data: { r2: { status: 'ok' } } }))) as typeof fetch;
  const results = await processJobs([{ ...job, receipt_id: 'r1' }, { ...job, receipt_id: 'r2' }], mock);
  assert(results[0].outcome === 'retry' && results[1].outcome === 'provider_accepted');
});

Deno.test('temporary HTTP failures retry, permanent request failures stop, network errors retry', async () => {
  for (const status of [429, 503, 400, 401]) {
    const results = await processJobs([job], (() => Promise.resolve(new Response(null, { status }))) as typeof fetch);
    assert(results[0].outcome === (status === 429 || status >= 500 ? 'retry' : 'failed'));
  }
  const result = await processJobs([job], (() => Promise.reject(new Error('network'))) as typeof fetch);
  assert(result[0].outcome === 'retry');
});

Deno.test('only dedicated nonempty worker credential is accepted', async () => {
  const secret = 'a'.repeat(64);
  const verify = (value: string) => Promise.resolve(value === secret);
  assert(await authorizedWorker(`Bearer ${secret}`, verify));
  assert(!await authorizedWorker(`Bearer ${'b'.repeat(64)}`, verify));
  assert(!await authorizedWorker(null, verify));
  assert(!await authorizedWorker('Bearer ', verify));
  assert(!await authorizedWorker('Bearer service-role-jwt', () => { throw new Error('Malformed credentials should not reach database'); }));
  assert(!await authorizedWorker(`Bearer ${secret}`, () => Promise.reject(new Error('Database unavailable'))));
});
