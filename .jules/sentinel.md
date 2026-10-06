## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2025-02-04 - Supabase Service Role Authorization Bypass
**Vulnerability:** Initializing a user-scoped Supabase client with the `service_role` key and a user's JWT Authorization header completely bypasses Row Level Security (RLS), as the service role key overrides user JWT context.
**Learning:** The service role key should strictly be reserved for admin tasks. For user-scoped operations in Edge Functions that respect RLS, the client must be initialized using the `anon` key alongside the user's JWT.
**Prevention:** Always use `Deno.env.get('SUPABASE_ANON_KEY')` when creating a `userScoped` client that passes an Authorization header.
