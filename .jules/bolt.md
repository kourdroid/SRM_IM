## 2024-05-18 - Missing useCallback on FlatList renderItems
**Learning:** In React Native, inline or unmemoized callback functions passed as `renderItem` to list components like `FlatList` cause the entire list item to re-render unnecessarily on parent component state changes. This is a common performance bottleneck specific to large lists in React Native.
**Action:** Always wrap `renderItem` functions in `useCallback` when using list components like `FlatList` to prevent unnecessary re-renders.
