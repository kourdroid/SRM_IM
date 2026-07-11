## 2025-02-12 - Inline functions in FlatList renderItem
**Learning:** React Native's `FlatList` component is sensitive to its `renderItem` prop receiving a new function reference on every render. If `renderItem` is defined as a non-memoized inline function within the component's render body, it causes unnecessary re-renders of all list items whenever the parent component re-renders (e.g. state changes like `isModalVisible`).
**Action:** When working with `FlatList` (and similar components like `FlashList`), always extract the `renderItem` and `keyExtractor` inline functions into memoized constants using `useCallback` to maintain stable references, and pass those constants as props to prevent unnecessary re-renders.

## 2025-02-13 - Stale closures in useCallback for renderItem
**Learning:** When memoizing `renderItem` using `useCallback` for `FlatList` or `FlashList` in React Native, the dependency array must strictly include all state variables and helper functions referenced within the callback. Failing to do so causes a stale closure bug where the list item always renders with the initial state values, even after asynchronous updates to state variables.
**Action:** Always fully read and expose the complete body of the target function, determine all local state and functions it references (even indirectly), and explicitly list them in the dependency array for `useCallback`.
