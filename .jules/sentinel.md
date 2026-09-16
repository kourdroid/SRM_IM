## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2026-09-16 - Weak Random Number Generation
**Vulnerability:** The application was using `Math.random()` to generate client IDs for incidents and materials. `Math.random()` is not cryptographically secure and its outputs can be predicted.
**Learning:** Client IDs should not be generated using cryptographically weak methods.
**Prevention:** Use `expo-crypto` and `Crypto.randomUUID()` to generate cryptographically secure client IDs.
