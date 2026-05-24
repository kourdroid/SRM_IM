## 2026-01-03 - [Remove hardcoded webhook]
**Vulnerability:** Found a hardcoded webhook URL fallback in components/backup_create.tsx acting as an internal endpoint/secret.
**Learning:** Legacy backup components might retain hardcoded endpoints intended for testing.
**Prevention:** Always ensure environment variables are validated dynamically and avoid fallback URLs in code that could act as exfiltration points or hardcoded endpoints.
