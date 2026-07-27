## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).

## 2025-02-06 - Insecure Random ID Generation
**Vulnerability:** Client IDs were generated using `Math.random().toString(36).slice(2, 10)`, which is cryptographically weak and predictable.
**Learning:** Predictable IDs can allow attackers to guess or reconstruct the random number generator's state, leading to potential enumeration attacks.
**Prevention:** Always use cryptographically secure methods like `Crypto.randomUUID()` for generating unique IDs, even on the client side.
