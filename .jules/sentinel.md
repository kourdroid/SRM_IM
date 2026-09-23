## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).

## 2025-02-04 - Weak Cryptographic ID Generation
**Vulnerability:** Using `Math.random().toString(36)` for ID generation is not cryptographically secure and can lead to predictable IDs and potential collisions.
**Learning:** `Math.random()` provides low entropy and predictability, making it unsuitable for IDs used across multiple systems or clients.
**Prevention:** Always use `expo-crypto`'s `randomUUID()` for generating unique, secure client IDs in Expo applications.
