## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2025-02-05 - Weak Random Number Generation
**Vulnerability:** Using `Math.random()` for generating client IDs is cryptographically weak and predictable. It is not suitable for generating secure identifiers, even when combined with `Date.now()`.
**Learning:** `Math.random()` should never be used where uniqueness and unpredictability are important for security or robust data integrity, such as generating IDs for database records or sync operations.
**Prevention:** Use a cryptographically secure pseudo-random number generator (CSPRNG) like `Crypto.randomUUID()` from `expo-crypto` for generating IDs in React Native/Expo applications.
