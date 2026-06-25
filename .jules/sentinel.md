## 2024-06-25 - Supabase PostgREST Query Injection
**Vulnerability:** Unsanitized user input directly interpolated into Supabase's `.or()` filter string.
**Learning:** Supabase JS `.or()` evaluates input as a raw PostgREST string. Destructively stripping characters (like `,` or `.`) breaks legitimate searches for times or decimals. The correct approach is to use PostgREST string literal syntax by wrapping the value in double quotes and escaping user-provided double quotes as `""`.
**Prevention:** Always sanitize user input for `.or()` strings by replacing `"` with `""` and wrapping the interpolated string in double quotes: `field.ilike."%${input.replace(/"/g, '""')}%"`.
