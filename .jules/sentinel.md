## 2026-06-16 - Supabase .or() Query Injection Risk
**Vulnerability:** Directly interpolating user input into Supabase JS's `.or()` string evaluator without filtering can allow PostgREST query injection via special characters.
**Learning:** Supabase uses PostgREST syntax under the hood for complex string queries. Unsanitized input containing `,`, `(`, `)` etc. modifies the logical structure of the SQL query.
**Prevention:** Always sanitize search inputs before interpolating them into `.or()` statements, specifically stripping characters like commas and parentheses.
