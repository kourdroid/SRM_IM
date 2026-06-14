## 2024-05-18 - Component Hoisting and FlatList Memoization
**Learning:** The inline rendering functions passed to `FlatList` like `renderItem` often trigger re-renders if parent scope functions are re-created or unmemoized. Hoisting pure formatters out of the React component's scope significantly reduces unnecessary work on every render cycle.
**Action:** Always hoist pure formatters or static configuration objects outside the component body. Use `useCallback` for functions passed to `renderItem` with correctly exhaustive dependency arrays.
