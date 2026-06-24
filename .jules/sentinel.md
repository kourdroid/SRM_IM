## 2024-06-24 - SQL Injection Vulnerability in Supabase Queries
**Vulnerability:** Unsanitized user input concatenated directly into a Supabase `.or()` query (e.g., `description.ilike.%${search}%`), which evaluates as a raw PostgREST string and allows query injection.
**Learning:** Supabase JS's `.or()` method is vulnerable to query injection if user input contains characters like `,`, `(`, `)`, `"`, `:`, `{`, `}`, because these are syntactically significant in PostgREST.
**Prevention:** Always sanitize user input by stripping or escaping PostgREST special characters before interpolating it into `.or()` strings.
