## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2025-02-04 - Weak Random Number Generation in IDs
**Vulnerability:** Using `Math.random()` for generating client IDs poses a security risk as it produces predictable values.
**Learning:** Always use cryptographically secure random number generators for identifiers that might have security implications or require global uniqueness without collisions.
**Prevention:** Use `expo-crypto` (`Crypto.randomUUID()`) or `crypto.randomUUID()` instead of `Math.random()`.
