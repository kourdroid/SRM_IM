## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2025-02-24 - Fix weak ID generation
**Vulnerability:** Insecure client ID generation using `Math.random()`
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable IDs and potential collisions, especially for critical identifiers like client IDs, media IDs, and material IDs.
**Prevention:** Use cryptographically secure random number generators like `expo-crypto`'s `randomUUID()` for generating secure identifiers.
