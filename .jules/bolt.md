## 2025-05-25 - React useCallback Optimization
**Learning:** Extracting inline functions into `useCallback` and hoisting pure helper functions prevents unnecessary React re-renders and function re-allocations, improving frontend performance, particularly in list components like `FlatList`.
**Action:** Always extract inline callback functions (e.g., `renderItem`, `onEndReached`) into `useCallback` hooks and place them appropriately. Ensure all dependent helper functions are also wrapped or hoisted to maintain stable references and satisfy the `react-hooks/exhaustive-deps` linter rule.
