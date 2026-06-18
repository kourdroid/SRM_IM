## 2024-06-18 - Supabase PostgREST Query Injection via .or() Method
**Vulnerability:** The `.or()` method in Supabase JS parses raw PostgREST syntax. Interpolating unsanitized user input allows attackers to inject arbitrary query conditions (like adding OR clauses to bypass filters) using characters like commas, parentheses, or dots.
**Learning:** Always sanitize user input before passing it into `.or()` or `.filter()` methods in Supabase when using string syntax instead of object syntax, because it evaluates as a raw PostgREST string.
**Prevention:** Use regex (e.g., `replace(/[.,()":{}]/g, '')`) to strip PostgREST structural characters from user input before interpolation, or use the object syntax if supported by the client.
