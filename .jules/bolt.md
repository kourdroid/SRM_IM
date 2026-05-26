## 2024-05-26 - [Replace FlatList with FlashList for incidents list]
**Learning:** React Native's default FlatList is often a performance bottleneck for long lists. @shopify/flash-list provides a drop-in replacement that recycles views and is significantly faster, as seen in `app/(admin)/incidents.tsx`.
**Action:** Replace `FlatList` with `FlashList` in `app/(tabs)/home.tsx` and `app/(admin)/users.tsx` to standardize and improve performance across the application.
