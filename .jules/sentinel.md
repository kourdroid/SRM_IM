## 2025-02-18 - Supabase query injection via .or()
**Vulnerability:** SQL Injection / Query Injection
**Learning:** Supabase JS `.or()` directly evaluates string interpolations as raw PostgREST strings. This means if you pass unfiltered user input like `query.or(\`description.ilike.%${search}%\`)`, special characters inside the user string (like commas `,` or periods `.`) will act as syntax delimiters for columns and operators, bypassing intended logic.
**Prevention:** Always sanitize strings passed to `.or()` (or use object notation if possible). For raw string inputs in `.or()`, replace/remove special characters like `[,\.\(\)\"\:\{\}]` to neutralize query injection.
