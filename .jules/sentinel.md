## 2024-05-24 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Interpolating raw user input into Supabase `.or()` strings allows attackers to inject arbitrary PostgREST operators bypassing intended filters.
**Learning:** Supabase parses `.or()` string arguments as raw PostgREST syntax. Unquoted values containing special characters break the query parser or evaluate as unintended operators. Wrapping just the input in quotes instead of the entire operator argument causes parse errors with wildcards.
**Prevention:** Always use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrap the entire argument (including wildcards) in double quotes (e.g., `ilike."%${safeSearch}%"`). Do not directly interpolate raw variables into `.or()` strings.
