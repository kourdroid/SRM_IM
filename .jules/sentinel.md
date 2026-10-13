## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2026-10-13 - Prevent RLS bypass in Edge Functions
**Vulnerability:** Edge Functions initializing a user-scoped Supabase client with the `service_role` key bypasses Row Level Security (RLS), even if a valid user JWT is passed in the `Authorization` header.
**Learning:** The Supabase client behaves as a superuser when initialized with the `service_role` key. To enforce RLS based on the user JWT provided in the global headers, the client must be instantiated using the `anon` key (`SUPABASE_ANON_KEY`).
**Prevention:** Always initialize the user-scoped `createClient` with the `anon` key when forwarding the user's `Authorization` header. Reserve the `service_role` key strictly for an administrative client that deliberately requires elevated privileges.
