
## 2024-06-05 - Supabase .or() Query Injection Vulnerability
**Vulnerability:** Supabase `.or()` query injection due to directly interpolating unsanitized user input (`filters.search.trim()`) into the filter string.
**Learning:** Supabase JS `.or()` evaluates its string argument as a raw PostgREST filter string. If user input contains PostgREST reserved characters like `,`, `.`, `(`, or `)`, it alters the query structure and allows query injection.
**Prevention:** Always sanitize user input by stripping reserved characters (e.g., using `.replace(/[.,()]/g, '')`) before interpolating it into a `.or()` string, or use the object-based filter API when available and not dynamically constructing complex nested combinations.
