## 2025-02-28 - PostgREST Injection via Unsanitized .or() Input
**Vulnerability:** Unsanitized user input (`filters.search`) directly interpolated into Supabase JS `.or()` PostgREST filter string, allowing query injection.
**Learning:** Supabase `.or()` evaluates arguments as raw PostgREST syntax. Special characters like `,`, `(`, `)` can alter the query logic and bypass filters.
**Prevention:** Always sanitize user input by removing/escaping characters that have special meaning in PostgREST before using them in `.or()` or `.ilike()` string interpolation.
