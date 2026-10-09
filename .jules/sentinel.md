## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).
## 2026-10-09 - Critical RLS Bypass in Edge Functions
**Vulnerability:** A Supabase user-scoped client was initialized using the `SUPABASE_SERVICE_ROLE_KEY` along with the user's JWT authorization header.
**Learning:** Instantiating a Supabase client with the service role key completely bypasses Row Level Security (RLS) and grants admin privileges, regardless of whether a user JWT is provided in the global headers. The user-scoped client is thus completely insecure and defeats the purpose of RLS policies.
**Prevention:** Always use the `anon` key (`SUPABASE_ANON_KEY`) when initializing a user-scoped client in Edge Functions that relies on the user's JWT Authorization header for RLS enforcement.
