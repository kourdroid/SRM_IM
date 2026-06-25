## 2024-06-25 - FlatList Optimization in Expo Router
**Learning:** In Expo Router / React Native apps, inline callbacks and unmemoized pure helper functions within components rendering large lists (like `FlatList`) cause substantial garbage collection overhead and re-renders.
**Action:** Always hoist pure helper functions (e.g., date formatting, URL parsing) outside the React component. Wrap `renderItem` and inline callbacks (like `onEndReached`) in `useCallback` with explicit dependency arrays to maintain stable function references across render cycles.
