## 2024-06-27 - PostgREST Injection in Supabase .or()
**Vulnerability:** PostgREST query injection via unsanitized user input in Supabase JS's `.or()` method.
**Learning:** Directly interpolating user input into `.or()` evaluates it as a raw PostgREST string. Destructively stripping characters breaks legitimate searches.
**Prevention:** Use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the interpolated value in double quotes.
