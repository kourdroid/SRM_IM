## 2024-05-18 - Extract Inline `onEndReached`
**Learning:** React Native `FlatList` components will re-render unnecessarily if inline functions are passed to `onEndReached`.
**Action:** Always extract `onEndReached` into a `useCallback` hook placed strictly *after* its dependencies.

## 2024-05-18 - Extract `renderItem` for Performance
**Learning:** Defining `renderItem` directly inside the component scope without memoization can lead to new function references on every render, causing `FlatList` to re-render all items unnecessarily.
**Action:** When working with `FlatList`, always ensure the `renderItem` function is memoized with `useCallback`, ensuring its dependencies are explicitly declared in the dependency array.
