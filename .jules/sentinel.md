## 2025-05-24 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Unfiltered user input interpolated directly into Supabase's `.or()` method evaluated as a raw PostgREST string, allowing for query injection (e.g., bypassing filters or causing server errors with reserved characters).
**Learning:** PostgREST string literals need to be wrapped in double quotes encompassing the entire value (including wildcards like `%`). Internal double quotes must be escaped as `""`. Stripping characters is destructive; correct quoting is safer and preserves data integrity.
**Prevention:** Always sanitize user input when using `.or()` with Supabase by replacing `"` with `""` and wrapping the entire search string in double quotes: `ilike."%${safeSearch}%"`.
