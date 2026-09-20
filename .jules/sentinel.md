## 2025-02-04 - PostgREST Query Injection in Supabase .or()
**Vulnerability:** Directly interpolating user input into Supabase JS `.or()` string filters allows for query injection, because the input is evaluated as a raw PostgREST string.
**Learning:** Destructively stripping characters like `,` or `.` is insufficient. Instead, use PostgREST string literal syntax by replacing user-provided double quotes with `""` and wrapping the entire argument in double quotes.
**Prevention:** When using `.or()` with `.ilike` and wildcards, ensure the entire string including wildcards is wrapped in double quotes (e.g., `ilike."%${safeSearch}%"`).

## 2025-02-14 - Weak Cryptography in ID Generation
**Vulnerability:** The codebase was using `Math.random().toString(36).slice(2, 10)` to generate client IDs (`clientId`, `clientEventId`, `clientMediaId`). `Math.random` is a cryptographically weak pseudo-random number generator that can produce predictable values, leading to potential ID collisions or predictable IDs that could be exploited in an Offline-First synchronization system.
**Learning:** React Native / Expo provides a secure random number generator via `expo-crypto`. Relying on standard web APIs like `Math.random` for any identifier or security-related generation in React Native is unsafe.
**Prevention:** For any UUID or random string generation, import `* as Crypto from 'expo-crypto'` and use `Crypto.randomUUID()`. If an 8-character string is needed to maintain schema compatibility with downstream systems, use `Crypto.randomUUID().slice(0, 8)`.
