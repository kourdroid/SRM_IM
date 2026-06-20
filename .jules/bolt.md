## 2024-06-20 - Memoization of FlatList renderItem

**Learning:** When using React Native `FlatList`, passing inline functions (like `renderItem={({ item }) => (...)}`) or functions defined inside the component scope without memoization (like `const renderItem = ({ item }) => (...)` directly in the function body) causes a new function reference to be created on every render of the parent component. This defeats any internal optimizations of `FlatList` and can lead to unnecessary re-renders of list items, degrading performance, especially for long lists or complex list items.

**Action:** Always wrap `renderItem` functions in `useCallback` to preserve their reference across renders unless their dependencies change. Ensure to include all referenced parent scope variables in the dependency array to satisfy ESLint's `react-hooks/exhaustive-deps` rule.
