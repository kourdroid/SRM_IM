## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2024-05-18 - RLS Bypass via Service Role Key in Edge Functions
**Vulnerability:** Edge Functions initializing a user-scoped Supabase client (`userScoped`) using `SUPABASE_SERVICE_ROLE_KEY` bypass Row Level Security entirely, even if a user JWT is passed in the `Authorization` header.
**Learning:** The service role key inherently has superuser privileges and ignores RLS. To properly enforce RLS based on the user JWT, the client must be initialized with `SUPABASE_ANON_KEY`.
**Prevention:** Always use `SUPABASE_ANON_KEY` combined with the `Authorization` header when creating user-scoped Supabase clients in Edge Functions.
