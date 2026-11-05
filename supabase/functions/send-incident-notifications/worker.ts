export interface DeliveryJob {
  id: string;
  lease_id: string;
  token: string;
  kind: 'initial' | 'reminder';
  receipt_id: string | null;
  notification_id: string;
  recipient_id: string;
  incident_id: string;
  type: 'BT' | 'MT';
  incident_type: string;
  depart_hta: string | null;
  commune: string | null;
  village: string | null;
  reported_at: string;
}

export type DeliveryResult = {
  outcome: 'ticket' | 'provider_accepted' | 'retry' | 'failed' | 'invalid_token';
  receipt_id?: string;
  error?: string;
};

type ExpoResult = { status?: string; id?: string; details?: { error?: string } };

export function buildMessage(job: DeliveryJob) {
  const reportedAt = new Date(job.reported_at);
  const time = Number.isNaN(reportedAt.getTime()) ? '' : new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(reportedAt);
  const location = [job.commune, job.village].filter(Boolean).join(' · ');
  const detail = [job.incident_type, job.type === 'MT' ? job.depart_hta : null].filter(Boolean).join(' · ');
  return {
    to: job.token,
    title: `${job.kind === 'reminder' ? 'RAPPEL INCIDENT' : 'NOUVEL INCIDENT'} · ${job.type}`,
    body: [location.slice(0, 140), detail.slice(0, 140), time ? `Signalé le ${time}` : ''].filter(Boolean).join('\n'),
    priority: 'high',
    sound: 'intervx_alert.wav',
    channelId: 'incidents-urgent-v1',
    ttl: 3600,
    tag: `incident-${job.notification_id}`,
    data: {
      notification_id: job.notification_id,
      recipient_id: job.recipient_id,
      incident_id: job.incident_id,
    },
  };
}

export function interpretExpoResult(value: unknown, receipt: boolean): DeliveryResult {
  if (!value || typeof value !== 'object') return { outcome: 'retry', error: 'MissingExpoResult' };
  const result = value as ExpoResult;
  if (result.status === 'ok') {
    if (receipt) return { outcome: 'provider_accepted' };
    if (typeof result.id === 'string' && result.id.length > 0 && result.id.length < 200) {
      return { outcome: 'ticket', receipt_id: result.id };
    }
    return { outcome: 'retry', error: 'MissingReceiptId' };
  }
  const error = result.details?.error;
  if (error === 'DeviceNotRegistered') return { outcome: 'invalid_token', error };
  if (error === 'MessageTooBig' || error === 'InvalidCredentials' || error === 'MismatchSenderId') {
    return { outcome: 'failed', error };
  }
  return { outcome: 'retry', error: error === 'MessageRateExceeded' ? error : 'ExpoProviderError' };
}

export async function processJobs(
  jobs: DeliveryJob[],
  fetcher: typeof fetch = fetch,
  accessToken?: string,
): Promise<DeliveryResult[]> {
  if (jobs.length === 0) return [];
  const isReceipt = jobs[0].receipt_id !== null;
  if (jobs.length > 100 || jobs.some(job => (job.receipt_id !== null) !== isReceipt)) {
    throw new Error('Process at most 100 jobs of the same delivery stage');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const response = await fetcher(`https://exp.host/--/api/v2/push/${isReceipt ? 'getReceipts' : 'send'}`, {
      method: 'POST', headers,
      body: JSON.stringify(isReceipt ? { ids: jobs.map(job => job.receipt_id) } : jobs.map(buildMessage)),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const result: DeliveryResult = {
        outcome: response.status === 429 || response.status >= 500 ? 'retry' : 'failed',
        error: `ExpoHTTP${response.status}`,
      };
      return jobs.map(() => result);
    }
    const payload = await response.json();
    return jobs.map((job, index) => interpretExpoResult(
      isReceipt ? payload?.data?.[job.receipt_id!] : payload?.data?.[index], isReceipt,
    ));
  } catch {
    return jobs.map(() => ({ outcome: 'retry', error: 'ExpoNetworkError' }));
  }
}

export async function authorizedWorker(provided: string | null, verify: (secret: string) => Promise<boolean>) {
  if (!provided?.startsWith('Bearer ')) return false;
  const secret = provided.slice(7);
  if (!/^[a-f0-9]{64}$/.test(secret)) return false;
  try {
    return await verify(secret);
  } catch {
    return false;
  }
}
