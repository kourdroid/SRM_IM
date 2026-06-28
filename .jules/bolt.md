## 2024-05-18 - Avoid unnecessary React component re-renders by wrapping inline callback functions
**Learning:** Inline callback functions like those passed to `onEndReached` in `FlatList` and `renderItem` causes the component to receive a new function reference on every render, triggering unnecessary re-renders.
**Action:** Extract inline functions passed to list components into separate constants wrapped in `useCallback` with appropriate dependency arrays.
