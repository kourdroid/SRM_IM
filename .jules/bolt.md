## 2024-06-30 - Prevent unnecessary re-renders in FlatList
**Learning:** Inline functions passed as props to list components (like onEndReached) and pure helper functions left inside component scopes cause unnecessary re-allocations and re-renders in React Native.
**Action:** Always extract inline callbacks using useCallback with explicit dependency arrays and hoist pure helper functions (e.g., date formatters) completely outside the component scope.
