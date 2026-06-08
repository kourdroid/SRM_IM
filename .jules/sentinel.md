## 2024-05-24 - Supabase Query Injection in .or() clause
**Vulnerability:** Found direct interpolation of unfiltered user input (`filters.search`) in Supabase JS `.or()` method (`query.or(\`description.ilike.%${filters.search}%...\`)`).
**Learning:** Supabase JS `.or()` expects a PostgREST syntax string, not a parameterized value. Injecting user input directly allows an attacker to inject PostgREST control characters (like commas) and modify the query structure, potentially bypassing security controls.
**Prevention:** Always sanitize user inputs by stripping out PostgREST control characters (`,`, `.`, `(`, `)`, `"`, `:`, `{`, `}`) before interpolating them into a `.or()` string, or use the object/array syntax if supported.
