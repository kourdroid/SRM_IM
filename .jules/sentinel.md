## 2025-05-30 - Fix N8N Webhook Security Vulnerability
**Vulnerability:** Hardcoded external integration webhook URL in `components/backup_create.tsx`.
**Learning:** Never commit or hardcode sensitive endpoint URLs, especially when connecting to external orchestration services like N8N, which can be easily identified and abused.
**Prevention:** Always pull sensitive URLs from environment variables (e.g. `process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL`) and include runtime fallback validations to ensure they are available before execution.
