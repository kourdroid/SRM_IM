## 2024-06-01 - FlatList optimizations on React Native

**Learning:** `useFocusEffect` dependencies can trigger infinite re-renders if a dependency like `syncPendingItems` is not memoized properly. In this codebase, `syncPendingItems` is correctly memoized in `useSync`, but adding it to the dependency array requires careful tracking of how it was defined to prevent catastrophic loops. Furthermore, adding `removeClippedSubviews` is generally safe but requires verifying visually that items render properly on iOS. I need to make sure to add clear inline comments explaining what each prop does to adhere strictly to the rules.

**Action:** Always check the implementation of hooks before blindly adding their returned functions to dependency arrays. Make sure to double-check and add the mandatory comments outlining what each performance optimization does.
