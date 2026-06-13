## 2025-02-27 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Supabase JS's `.or()` method evaluates raw PostgREST strings. Directly interpolating unfiltered user input into it allows query injection.
**Learning:** Because `.or()` takes a single string for multiple conditions, unescaped special characters (like commas, periods, parentheses) in user input can break the query structure and inject arbitrary PostgREST operators.
**Prevention:** Always sanitize user input by stripping PostgREST reserved characters (`[,.()":{}]`) before interpolating it into an `.or()` clause.
