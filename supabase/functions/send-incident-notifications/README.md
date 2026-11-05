# Admin incident notifications

The migrations add an inbox for each approved administrator or director and a private per-device delivery queue. Existing incidents are not backfilled. New open incidents create inbox rows even when no recipient has registered a phone. Registering a phone does not replay old push alerts.

## Deployment

1. Apply the notification migrations, including `20261104131602_director_incident_notifications.sql`, using the Supabase migration workflow. The original migration enables `pg_net` and `pg_cron`, creates the queue, and schedules a one-minute retry wake-up. The incident trigger wakes the worker immediately; no HTTP call blocks field submission.
2. Generate the worker credential entirely within SQL using `encode(extensions.gen_random_bytes(32),'hex')` and save it directly in Vault as `intervx_notification_worker_secret`. Store the project API origin in Vault as `intervx_notification_project_url`. Do not return, read back, or expose the generated credential. No additional Edge environment secret is required.
3. Deploy this directory's `index.ts`, `worker.ts`, `deno.json`, and lockfile as `send-incident-notifications`, with gateway JWT verification disabled. The function verifies its dedicated bearer credential through the service-role-only `verify_admin_notification_worker` RPC, which compares SHA-256 digests against Vault without returning the stored secret. Only after successful verification does it claim delivery jobs. It uses the platform-provided service-role key only on the server.
4. If enhanced Expo Push security is enabled for the Expo project, set the corresponding `EXPO_PUSH_ACCESS_TOKEN` Edge secret. This is optional when Expo Push access-token enforcement is disabled.
5. Configure FCM v1 credentials in EAS and build/install the notification-enabled Android app. Channel `incidents-urgent-v1` must exist on the phone, with bundled sound `intervx_alert.wav`, before registering its Expo Push token.
6. Exercise a real authorized incident on the admin phone and verify the inbox, banner, sound, incident tap, and acknowledgement. Check both foreground and background/locked delivery.

Client API:

- `register_admin_push_token({p_token})`: approved admin or director and active auth session required; repeat calls are idempotent and account switches transfer ownership.
- `unregister_admin_push_token({p_token})`: deletes only the current user's registration; call before local sign-out.
- `admin_notifications`: authenticated approved admins and directors can select their own rows; no direct client writes or push-token reads.
- `acknowledge_admin_notification({p_notification_id})`: idempotent, recipient only; cancels unsent work, including the reminder.

Only `service_role` can call the claim/result RPCs. The worker rechecks approval, session existence, token ownership, incident state, and acknowledgement before claiming a send. A race after claiming cannot retract a push already accepted by the provider.

## Delivery behavior

- One initial attempt stream and one reminder stream per inbox notification and registered device. A reminder becomes eligible five minutes after the initial send was accepted by Expo, provided the incident remains open and the alert unacknowledged.
- Jobs are leased for two minutes using `FOR UPDATE SKIP LOCKED`. Temporary failures retry with bounded exponential backoff (five send attempts). Jobs older than 24 hours stop producing new pushes; the durable inbox remains.
- Receipts are checked after 15 minutes, with bounded retries. `provider_accepted` means Expo handed the notification to FCM/APNs; it does not mean the person received or read it. Acknowledgement is the separate human signal.
- `DeviceNotRegistered` removes the invalid registration. Misconfigured credentials and malformed requests produce failed jobs, with sanitized error codes in the queue and function logs. An operator must correct the configuration and explicitly requeue relevant unexpired jobs.
- Android tags replace already displayed retries/reminders for the same inbox notification. A worker crash after Expo accepts a send but before its receipt ID is recorded can still cause duplicate sound; delivery is not exactly once.
- No guaranteed sound or delivery through disabled notifications, Do Not Disturb, OS force-stop, loss of network, or provider outages. Offline field incidents cannot notify until they synchronize.
- Delivery to a phone while the app is closed relies on OS push presentation. Revoking a server session removes its token, but a push already queued with the provider cannot be withdrawn. Local-only offline logout must be treated accordingly.

Operational checks: inspect sanitized delivery states in `private.admin_notification_deliveries`, function logs, and the named Cron job. Restrict these checks to trusted operators because push tokens are confidential. Retain only the needed Cron execution history for `intervx-admin-notifications`; it grows independently of notification traffic.

## Verification

`deno test supabase/functions/send-incident-notifications/worker_test.ts`

`deno check --config supabase/functions/send-incident-notifications/deno.json supabase/functions/send-incident-notifications/index.ts`

`tests/notifications-db-fixture.sql` bootstraps a minimal schema in an isolated local Supabase PostgreSQL 17 database. Never run the fixture on production. Apply the notification migration there, then run `tests/notifications-db-regression.sql` with `ON_ERROR_STOP=1`. The regression transaction rolls back its fixture accounts, incidents, sessions, jobs, and uncommitted HTTP requests.
