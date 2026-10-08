## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2026-10-08 - Privilege Escalation via Edge Function Service Role
**Vulnerability:** The Edge Function `generate-report-export` used the Supabase `service_role` key to initialize a user-scoped client intended to respect RLS.
**Learning:** Initializing a Supabase client with the `service_role` key completely bypasses Row Level Security (RLS) and grants admin privileges, regardless of whether a user JWT Authorization header is subsequently passed to the client. This allows any authenticated user to potentially access or modify data beyond their permissions.
**Prevention:** Always use the `anon` key (`SUPABASE_ANON_KEY`) when creating a user-scoped client in Edge Functions that relies on the user's Authorization header to enforce RLS.
