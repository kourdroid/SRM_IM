## 2026-06-02 - Prevent PostgREST Query Injection in Supabase .or()
**Vulnerability:** Unsanitized user input interpolated into Supabase's `.or()` method allows for query injection, as PostgREST evaluates the string directly.
**Learning:** Supabase translates `.or()` strings directly to PostgREST query syntax. Special characters like commas `,`, dots `.`, and parentheses `()` can be used to break out of the intended filter and inject arbitrary conditions.
**Prevention:** Always sanitize user input by stripping characters like `,`, `.`, `(`, and `)` before interpolating them into `.or()` query strings, or use a safer querying method if available.
