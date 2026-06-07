## 2024-05-17 - React Native FlatList Performance
**Learning:** In React Native, inline functions for `renderItem` or passing un-memoized functions down to `FlatList` causes `FlatList` to re-render all items needlessly when the parent component state changes (e.g., when a modal opens). This is a well-known React Native bottleneck.
**Action:** Always wrap `renderItem` functions and any helper functions they rely on in `useCallback`. Ensure all parent scope variables are included in the dependency array to satisfy ESLint's `react-hooks/exhaustive-deps`.
