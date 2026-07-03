## 2024-05-24 - Supabase PostgREST Query Injection
**Vulnerability:** Unsanitized user input directly interpolated into Supabase `.or()` methods.
**Learning:** Supabase JS `.or()` parses its argument as a raw PostgREST string. If a user inputs commas or double quotes, it alters the query structure, leading to query injection or crashes.
**Prevention:** Always escape double quotes as `""` and wrap the interpolated string (including wildcards) entirely in double quotes, e.g., `ilike."%${safeSearch}%"`.
