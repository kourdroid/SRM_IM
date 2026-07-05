## 2025-05-25 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS's `.or()` method evaluated as a raw PostgREST string, allowing for query injection via unescaped quotes and reserved characters.
**Learning:** The `.or()` filter parses its argument as a raw string. Without proper escaping and quoting, an attacker can manipulate the query. When using `.ilike`, wrapping quotes must encompass the wildcards (`ilike."%${safeSearch}%"`).
**Prevention:** Always escape double quotes as `""` and wrap user input in PostgREST string literal syntax (double quotes) within `.or()` filters.
