## 2026-06-10 - Supabase SQL Injection Risk via string interpolation in `.or()`
**Vulnerability:** Supabase JS `query.or()` function accepts string arguments, and in `src/core/services/incidentAdminService.ts`, user input `filters.search` is directly interpolated into the string: `query.or(\`description.ilike.%${filters.search.trim()}%,village.ilike.%${filters.search.trim()}%\`)`. This allows for injection into the PostgREST query.
**Learning:** PostgREST `.or()` filter string interpolation allows malicious users to close the filter and append arbitrary conditions if characters like `,`, `"`, `(`, `)` are not sanitized.
**Prevention:** Always sanitize user input before interpolating it into a Supabase `.or()` filter string, or use an RPC if complex parameterized searches are needed.
