## 2025-02-23 - Prevent PostgREST Query Injection in Search

**Vulnerability:** Directly interpolating user search input into PostgREST string `.or()` filters (e.g., `query.or(\`description.ilike.%${search}%\`)`) allows for query injection, bypassing filters or causing errors if the search contains reserved characters like quotes or commas.
**Learning:** Supabase uses PostgREST syntax for `.or()` strings. If user input contains PostgREST reserved characters, it alters the query logic.
**Prevention:** Always use PostgREST string literal syntax by wrapping the entire argument in double quotes and escaping user-provided double quotes (e.g., `ilike."%${search.replace(/"/g, '""')}%"`).
