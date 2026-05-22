## 2024-05-21 - [Sanitize Error Logs]
**Vulnerability:** Information leakage through `console.log` and `console.error` traces, such as HTTP headers, raw error bodies, error hints, and internal stack traces.
**Learning:** Detailed error information can leak sensitive implementation details, API structures, or backend paths that can be exploited. This is especially risky in edge function handlers and sync mechanisms where error.details or error.hint could expose database or API schemas.
**Prevention:** Replace detailed object logging with generic error messages and remove sensitive data (like headers or raw response texts) from frontend and middle-tier logs before production.
