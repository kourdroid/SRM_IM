## 2023-10-25 - Supabase PostgREST Query Injection via .or()
**Vulnerability:** Query injection risk in `src/core/services/incidentAdminService.ts` where unfiltered user input was directly interpolated into Supabase's `.or()` method.
**Learning:** Directly interpolating user input into Supabase JS's `.or()` method evaluates as a raw PostgREST string. Characters like `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}` can alter the query structure.
**Prevention:** Always sanitize user input by stripping characters like `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}` before interpolating them into a PostgREST `.or()` filter string.
