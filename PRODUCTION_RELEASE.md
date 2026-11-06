# SRM Android Production Release

## Required cloud deployment

The app must not be built for production until the latest Supabase migration and
the report export Edge Function are deployed.

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy generate-report-export
```

Verify that the `incident-media` bucket remains configured for the existing app
access policy and that the new `report-exports` bucket is private.

## Release checks

### Admin incident notifications and image sharing (1.0.10)

Notification backend deployment and operating notes are in
`supabase/functions/send-incident-notifications/README.md`.
Configure Android app `com.kaliits.srmims` in Firebase project
`famous-vehicle-465219-d1`, then assign an FCM v1 service-account credential in EAS.
Use a messaging-only service account; keep its private key out of Git and app bundles.
Upload `google-services.json` as the EAS file environment variable
`GOOGLE_SERVICES_JSON` in each build environment used for Android releases.
For local development, the ignored root `google-services.json` is also supported.
The custom sound, notification module and image sharing require a native build. Version 1.0.10
isolates this native runtime from installed 1.0.8 builds.

On the administrator's phone, open Notifications from the home bell or Settings,
activate alerts, and check the reported permission, registration and sound status.
Verify foreground, background, terminated-app and locked-screen alerts, including
offline field sync, token rotation, logout, acknowledgement and the five-minute
reminder. Do not treat an accepted provider receipt as proof of phone delivery.

Verified on 2026-10-26:

- Firebase FCM v1 is enabled on the Spark plan. The dedicated `Intervx Push`
  service account has the Firebase Cloud Messaging API Admin role, and its key
  is assigned to `com.kaliits.srmims` in EAS. Google authentication and an FCM
  validation-only request both returned HTTP 200; no phone notification was sent.
- `GOOGLE_SERVICES_JSON` is stored as an EAS secret file for production, preview
  and development. Production Sentry source-map upload is enabled in `eas.json`.
- Notification migration `20261026152506` and atomic closure/pagination migration
  `20261026213552` are deployed. The worker is active, rejects unauthenticated
  requests with HTTP 401 and accepts its Vault credential with HTTP 200.
- Client/sync/inbox/worker regressions, typecheck, lint, Edge checks and all 18
  Expo Doctor checks passed. Both database regression transactions passed on
  the live schema and rolled back their canaries. Existing counts remained
  25 incidents and 17 profiles. No phones are registered until activation.
- Production Android build 33, version/runtime 1.0.9, failed during Sentry
  source-map upload because its previous token returned HTTP 401:
  https://expo.dev/accounts/kourchal/projects/SRM/builds/c7969545-ec78-419d-9005-d6dc6a9588f0
  An approved organization CI token was validated with `sentry-cli info` and
  stored as the EAS production secret `SENTRY_AUTH_TOKEN`.

Verified on 2026-10-27:

- Production Android build 34 finished successfully with version/runtime 1.0.10:
  https://expo.dev/accounts/kourchal/projects/SRM/builds/e9289ef3-b859-4ff3-be69-8d0cabdcaefc
- Its logs confirm `Uploaded files to Sentry` for release
  `com.kaliits.srmims@1.0.10+34`, distribution `34`, followed by
  `BUILD SUCCESSFUL`. The replacement CI credential works for source-map uploads.
- The build contains optional incident PNG sharing and urgent admin notifications.
  Local regressions, typecheck, lint, Edge checks, all 18 Expo Doctor checks and
  the Android Hermes export passed before submission to EAS.
- The signed Android App Bundle is available from the build page. Build success
  does not verify installed-device behavior or constitute Google Play publication.

Field members can tap the share icon on a saved incident card or its detail
sheet. The app creates an Intervx PNG using the saved incident, including locally
pending incidents, then opens the system share sheet. Sharing is optional and
does not change saving, closure or synchronization. Empty sections are omitted;
long text is bounded with an explicit continuation marker. Personal reclamation
names, coordinates and photos are not included automatically.

Verify PNG generation, French and Arabic text, sharing to WhatsApp or another
installed recipient, cancellation, offline incidents and long descriptions on
an Android phone. Native sharing and notification delivery remain unverified
until these device checks are completed. No Play publication has been performed.

```powershell
pnpm release:check
npx eas-cli env:list --environment production
pnpm build:preview
```

Install the preview APK on at least one low-end Android device. Test offline
incident creation, app termination before sync, reconnect, five-photo upload,
field closure, admin closure, and full XLSX report export.

## Google Play

After preview verification:

```powershell
pnpm build:production
pnpm submit:production
```

The first Android App Bundle may need to be uploaded manually in Play Console.
Use the closed testing track with at least 12 opted-in testers for 14 continuous
days before applying for production access. Production distribution is intended
to be unlisted.

## EAS Update

Publish JavaScript-only fixes to `preview` first. Promote to `production` only
after preview-device verification. Native dependency or permission changes
always require a new Play Store build.


## Material declaration at closure (BT and MT)

Apply `20261102175300_explicit_no_material_closure.sql` after the existing migrations
and before distributing this app version or its EAS update. The new app reads
`incidents.no_material_used` and calls the three-argument closure RPC. The migration
preserves the two-argument RPC for installed clients. Existing incident material
records remain unchanged; historical empty declarations are not marked as confirmed none.

Focused verification:

```powershell
node tests/sync-regression.cjs
node tests/material-selector-regression.cjs
node tests/material-closure-postgres.cjs
```

The PostgreSQL test requires Docker and uses a disposable `postgres:17-alpine`
container with no published ports, without changing the linked Supabase database.

On a preview Android device, check both BT and MT: creation without any material
entry, closure with material and quantity, closure with “Aucun matériel utilisé”,
offline closure followed by reconnect and app restart, and reopening from admin.
Check closure from both admin incident details and the dashboard. An incident with
existing materials must retain them. An unfinished draft from the previous version
must retain any material text for completion at closure.

Verified on 2026-11-02: material closure migration applied to SRM
(`tnytudtejqislmkpqaiq`, also used by EAS preview), recorded as version
`20261102175300`. Authenticated admin BT/MT checks passed for opening without
materials, rejecting undeclared closure, explicit none, material closure and
reopening. Canary transactions rolled back; counts remained 39 incidents and
42 material records. Physical-device verification remains pending.
