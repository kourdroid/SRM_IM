## 2024-06-29 - Optimize FlatList inline functions
**Learning:** Found inline callback functions passed to `onEndReached` in `app/(tabs)/home.tsx` that will cause `FlatList` to receive a new function reference on every render, triggering unnecessary re-renders.
**Action:** Extract inline callback functions like `onEndReached` in `FlatList` components to `useCallback` to prevent unnecessary re-renders.
