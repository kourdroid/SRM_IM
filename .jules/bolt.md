## 2024-03-24 - React Native FlatList Performance
**Learning:** Inline callback functions like `onEndReached` in React Native lists (like `FlatList`) cause new function references on every render, leading to unnecessary re-renders of the list and degrading scroll performance, especially on low-end devices.
**Action:** Always wrap inline functions passed to list components in `useCallback` hook before creating a PR.
