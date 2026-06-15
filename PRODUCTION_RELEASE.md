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

```powershell
pnpm release:check
npx eas-cli env:list --environment production
pnpm build:preview
```

Install the preview APK on at least one low-end Android device. Test offline
incident creation, app termination before sync, reconnect, five-photo upload,
field closure, admin closure, and full CSV report export.

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
