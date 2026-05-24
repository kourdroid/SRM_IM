## 2024-05-14 - Replace FlatList with FlashList
**Learning:** `FlashList` from `@shopify/flash-list` is preferred over `FlatList` in this codebase for optimal performance when rendering long lists. Note that because `estimatedItemSize` is missing from the typescript bindings in v2.0.2, you must use `// @ts-ignore` above the prop.
**Action:** Always prefer `FlashList` for lists, and remember to use `// @ts-ignore` before `estimatedItemSize={...}`.
