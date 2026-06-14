## 2025-02-14 - Prevent PostgREST query injection via Supabase .or()
**Vulnerability:** PostgREST filter injection where unsanitized user search input could manipulate the `.or()` filter string.
**Learning:** Supabase JS's `.or()` method evaluates raw PostgREST string segments. Interpolating unfiltered user input directly allows attackers to inject operators and alter query logic.
**Prevention:** Always sanitize inputs by stripping special PostgREST syntax characters (e.g., `,`, `.`, `(`, `)`, `"`, `:`, `{`, `}`) before string interpolation in `.or()` queries.
