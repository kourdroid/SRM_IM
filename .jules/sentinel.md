## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).

## 2025-02-04 - Weak Cryptographic IDs with Math.random()
**Vulnerability:** Generating critical domain/database IDs with `Math.random()` creates weak, predictable entropy, increasing the risk of ID collisions (especially in disconnected/offline-first apps syncing to a central server) and potentially allowing malicious users to predict IDs.
**Learning:** `Math.random()` must never be used for security-sensitive unique identifiers or syncing operation keys.
**Prevention:** Always use `Crypto.randomUUID()` (e.g., from `expo-crypto` in React Native/Expo apps) for ID generation.
