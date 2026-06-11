## 2024-06-05 - PostgREST or() Filter Injection
**Vulnerability:** Query injection via directly interpolating unsanitized user search input into Supabase JS's `.or()` filter string.
**Learning:** PostgREST evaluates characters like commas and dots as logical operators within filter strings. Direct interpolation allows attackers to break out of the intended query logic.
**Prevention:** Always sanitize user input by stripping reserved PostgREST characters (e.g., `[,.()":{}]`) before interpolating into `.or()` or `.and()` filter strings.
