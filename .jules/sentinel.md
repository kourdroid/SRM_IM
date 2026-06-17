## 2024-05-24 - Supabase JS PostgREST Query Injection
**Vulnerability:** PostgREST query injection via Supabase `.or()` string interpolation.
**Learning:** Supabase JS `.or()` evaluates raw PostgREST strings, making it vulnerable to query injection if user input contains characters like `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}`.
**Prevention:** Always sanitize inputs by removing these characters before using them in `.or()` filters.
