## 2026-05-30 - FlatList Render Optimization
**Learning:** In React Native, passing inline functions to `FlatList`'s `renderItem` prop causes list items to un-necessarily re-render whenever the parent component state changes. Also, long lists can consume too much memory if performance props are not tweaked.
**Action:** Always wrap `renderItem` in `useCallback` and tweak `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, and `removeClippedSubviews` properties when utilizing `FlatList` for long lists.
