
## 2025-02-26 - Supabase PostgREST Query Injection in `.or()`
**Vulnerability:** Directly interpolating user input into Supabase's `.or()` filter string allows for PostgREST query injection because it's evaluated as raw string.
**Learning:** The `.or()` filter does not automatically parameterize or quote arguments when provided as a raw string. Destructively stripping characters breaks valid searches.
**Prevention:** Use PostgREST string literal syntax by replacing user-provided double quotes with `""` (`search.replace(/"/g, '""')`) and strictly wrapping the entire argument (including wildcards like `%`) in double quotes, e.g., `ilike."%${safeSearch}%"`.
