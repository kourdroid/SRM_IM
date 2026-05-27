## 2024-05-20 - [Hardcoded Webhook URLs in Client Code]
**Vulnerability:** A hardcoded n8n webhook URL with an exposed unique identifier path (`/webhook-test/2681ae8b-4c85-4522-bf61-dd51b00eb520`) was present in `components/backup_create.tsx` as a fallback.
**Learning:** Even fallback URLs used for testing during development shouldn't be hardcoded into the final client application, as they expose test endpoints which could be flooded or accessed by unauthorized users.
**Prevention:** Rely strictly on environment variables (`process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL`) and explicitly throw an error or handle the missing configuration case securely.
