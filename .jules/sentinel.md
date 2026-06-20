## 2024-06-20 - Fix PostgREST Query Injection in Supabase .or() Filter
**Vulnerability:** Unsanitized user input passed directly to Supabase JS `.or()` method, allowing PostgREST query injection via special characters.
**Learning:** Supabase JS `.or()` evaluates arguments as raw PostgREST syntax, so characters like `,`, `.`, `(`, `)` can alter the query structure, bypassing intended logic or causing errors.
**Prevention:** Always sanitize user input passed to `.or()` by removing or escaping PostgREST special syntax characters (`/[,.()":{}]/g`).
