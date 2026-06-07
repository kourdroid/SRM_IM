## 2024-05-24 - PostgREST Query Injection in Supabase JS
**Vulnerability:** User input was directly interpolated into Supabase JS `.or()` queries without sanitization, allowing for PostgREST query injection via special characters.
**Learning:** Supabase `.or()` evaluates raw strings. Unsanitized strings containing `,`, `.`, `(`, or `)` can manipulate the query logic or trigger syntax errors.
**Prevention:** Always sanitize user input before interpolating it into `.or()` strings by stripping or escaping PostgREST special characters.
