## 2026-05-31 - [PostgREST Injection Vulnerability in Supabase JS]
**Vulnerability:** Directly interpolating user input into the `.or()` filter string allowed PostgREST query structure manipulation if the input contained characters like `,`, `.`, `(`, or `)`.
**Learning:** The Supabase JS `.or()` method accepts a raw PostgREST filter string instead of passing arguments safely to an underlying driver. Unescaped search terms can inject logic.
**Prevention:** Always sanitize or strictly validate strings passed into `.or()` (e.g., stripping PostgREST reserved characters like `.`, `,`, `(`, `)`, `"`) or avoid `.or()` in favor of `.filter()` chained with `.textSearch()` if applicable.
