
## 2025-02-24 - Semantic Badge Containers
**Learning:** To ensure visual consistency across platforms and views, applying box-model styles (e.g., backgroundColor, padding, borderRadius) directly to `<Text>` components causes inconsistencies in React Native layout rendering.
**Action:** Always use a distinct `<View>` container for box-model styles on semantic badges like `typeBadge` or `statusBadge`, applying typography styles exclusively to the nested `<Text>` component.
