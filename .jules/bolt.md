## 2024-06-23 - FlatList Component Render Optimization
**Learning:** Inline pure helper functions (like `formatIncidentDate`, `parseMediaUrls`, `openIncidentMap`) and inline list handlers (like `onEndReached`, `renderItem`) inside React components cause unnecessary function re-allocations on every render, negatively impacting `FlatList` performance.
**Action:** Always hoist pure helper functions entirely outside of the React component, and always wrap list handlers and render items passed to `FlatList` in `useCallback` with complete dependency arrays.
