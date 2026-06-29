## 2025-06-29 - [Fix Supabase PostgREST Query Injection in or() method]
**Vulnerability:** Directly interpolating user input into Supabase's `.or()` filter creates a PostgREST query injection vulnerability because the input is evaluated as a raw PostgREST string. Characters like commas or double quotes can alter the intended query logic.
**Learning:** Destructively stripping characters is bad practice. The correct PostgREST string literal syntax should be used by replacing user-provided double quotes with `""` and wrapping the interpolated value in double quotes.
**Prevention:** Always escape double quotes and wrap user input in double quotes when using Supabase's `.or()` method with string interpolation.
