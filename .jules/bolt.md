## 2026-05-29 - [SQLite Binding Type Mismatch]
**Learning:** The expo-sqlite library's parameter bindings strictly require non-undefined types (e.g., SQLiteBindValue). Passing potentially undefined variables like `user?.id` directly into query parameters causes a TypeScript compilation error (`Type 'undefined' is not assignable to type 'SQLiteBindValue'`).
**Action:** Always provide a fallback value (like `|| ''`) when passing potentially undefined properties to expo-sqlite queries to ensure type safety.
