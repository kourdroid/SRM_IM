## 2024-06-15 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Supabase JS `.or()` method evaluated interpolated user strings as raw PostgREST syntax, allowing for query injection in `incidentAdminService.ts`.
**Learning:** PostgREST parses strings inside `.or()` with special characters (like `,`, `.`, `(`, `)`). When unfiltered user search input is interpolated, attackers can manipulate the query structure.
**Prevention:** Always sanitize user input by stripping `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}` before interpolating into `.or()` statements.
