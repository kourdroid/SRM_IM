## 2026-07-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Supabase JS `.or()` filters evaluate as raw PostgREST strings, allowing query injection if unfiltered user input is directly interpolated.
**Learning:** Directly interpolating user input into `.or()` strings exposes the application to query injection because the entire string is parsed as PostgREST syntax. Reserved characters like commas or periods in the user input will break the query.
**Prevention:** Always escape double quotes by replacing them with `""` and wrap the entire argument, including wildcards, in double quotes (e.g., `ilike."%${safeSearch}%"`) when interpolating user input into `.or()` filters.
