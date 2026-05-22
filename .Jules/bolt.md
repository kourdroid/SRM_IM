## 2024-05-21 - FlashList Integration
**Learning:** FlashList v2.0.2 types are missing `estimatedItemSize` which causes TS errors, even though the prop is required for performance.
**Action:** Always add `// @ts-ignore` above `estimatedItemSize` when migrating FlatList to FlashList until the package is updated.
