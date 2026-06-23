## 2024-06-23 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Unsanitized user input directly interpolated into Supabase's `.or()` filter string.
**Learning:** Supabase JS's `.or()` method evaluates raw PostgREST strings. Directly interpolating strings without sanitization allows query injection using characters like commas or parentheses.
**Prevention:** Always sanitize inputs by removing characters like `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}` before interpolating them into `.or()` strings.
