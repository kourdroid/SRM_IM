## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** PostgREST parses unquoted strings in `.or()` as syntax, which can lead to injection if the string contains reserved characters.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).

## 2025-02-04 - Insecure Client ID Generation
**Vulnerability:** Using `Math.random()` to generate client and media IDs in a client-side environment (React Native) is cryptographically weak and predictable.
**Learning:** `Math.random()` should never be used for identifiers that need to be globally unique or secure against collision and predictability, especially in offline-first synced apps where collisions could overwrite data.
**Prevention:** Always use cryptographically secure UUID generation for identifiers (e.g., `Crypto.randomUUID()` from `expo-crypto`).
