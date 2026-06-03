## 2026-06-03 - FlatList Render Optimization
**Learning:** In React Native, inline pure functions and unmemoized `renderItem` functions inside components (like `Home`) cause unnecessary function re-allocations on every render cycle. This is especially impactful for `FlatList` which renders many items.
**Action:** Always proactively hoist pure helper functions (e.g., date formatters, parsing utilities) outside the component scope and wrap `renderItem` functions in `useCallback` with appropriate dependencies to maintain stable references and prevent list item re-renders.
