## 2024-05-24 - React Native FlatList Re-render Optimizations
**Learning:** Inline functions in FlatList props (like onEndReached or keyExtractor) and unmemoized renderItem functions cause unnecessary re-renders of the entire list on every component state change. Pure helper functions (like date formatters) defined inside the component also cause unnecessary allocations.
**Action:** Always hoist pure helper functions outside the React component. Always wrap renderItem and list callbacks in useCallback with proper dependency arrays to prevent performance bottlenecks in large lists.
