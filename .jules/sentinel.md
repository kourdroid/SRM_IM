## 2024-10-24 - PostgREST Query Injection in .or()
**Vulnerability:** Unfiltered user input directly interpolated into Supabase `.or()` methods allowed query injection because commas and other special characters act as PostgREST operators.
**Learning:** PostgREST parses the string passed to `.or()`. An unescaped comma inside the search string will split the expression unexpectedly.
**Prevention:** Always sanitize input by escaping double quotes (`replace(/"/g, '""')`) and wrapping the interpolated value in double quotes to force PostgREST to treat it as a string literal.
