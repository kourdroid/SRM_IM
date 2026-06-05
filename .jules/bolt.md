## 2024-06-05 - Render Item Re-allocations in List
**Learning:** FlatList render items created inside functional components without `useCallback` or being hoisted cause unnecessary re-allocations on every render, increasing GC pressure and potentially re-rendering items unnecessarily.
**Action:** Always extract pure helper functions (like date formatters or parsers) outside the component scope, and wrap inline render items (e.g. `renderIncidentItem`) with `useCallback` including all necessary scope variables in the dependency array.
