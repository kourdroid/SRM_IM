## 2024-10-24 - Supabase JS Query Injection via .or()
**Vulnerability:** Directly interpolating user input into Supabase JS's `.or()` method strings allows PostgREST query injection.
**Learning:** Supabase JS treats the string passed to `.or()` as raw PostgREST syntax. Unsanitized characters like commas, periods, or parentheses in the input can escape the intended condition and alter the query logic.
**Prevention:** Always sanitize user input by stripping PostgREST control characters (like `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}`) before using it in string-based `.or()` methods.
