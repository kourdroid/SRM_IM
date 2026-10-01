## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2026-10-01 - Weak Randomness for ID Generation
**Vulnerability:** Used Math.random() to generate client IDs, which is cryptographically weak.
**Learning:** Found Math.random().toString(36).slice(2, 10) in multiple places for generating IDs.
**Prevention:** Use expo-crypto and Crypto.randomUUID().slice(0, 8) to generate secure IDs.
