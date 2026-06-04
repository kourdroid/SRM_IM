## 2026-06-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Interpolating unfiltered user input directly into Supabase's `.or()` method allows for PostgREST query injection.
**Learning:** The `.or()` method evaluates string arguments as raw PostgREST syntax. Characters like `,`, `.`, `(`, and `)` act as logical operators and syntax boundaries. If user input contains these characters, it can alter the intended query structure, bypassing filters or exposing unintended data.
**Prevention:** Always sanitize user input by removing or properly escaping PostgREST syntax characters (e.g., `replace(/[,.()]/g, '')`) before interpolating it into a Supabase `.or()` string.
