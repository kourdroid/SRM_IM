## 2024-06-26 - Hoisting and Memoization for FlatList Performance
**Learning:** Inline render functions and callbacks (like onEndReached) in FlatList components cause unnecessary re-renders by creating new function references on every render.
**Action:** Always hoist pure helper functions outside the component and wrap inline render and callback functions in useCallback with explicitly defined dependency arrays.
