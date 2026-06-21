## 2025-06-21 - Optimize FlatList inline functions
**Learning:** React Native `FlatList` components can suffer from unnecessary list item re-renders if the `renderItem` or `onEndReached` props are passed inline functions. Wrapping them in `useCallback` with strict dependency arrays prevents new function references on every render, keeping the list performant.
**Action:** Always extract and memoize inline callbacks passed to list components using `useCallback`. Ensure all parent scope variables are included in the dependency array to satisfy ESLint's `react-hooks/exhaustive-deps` rule.
