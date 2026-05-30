## 2024-05-30 - The Flat Field Rule
**Learning:** Decorative shadows on buttons (e.g., auth screens) violate the industrial design language ("The Flat Field Rule"). Depth is conveyed through tonal layering and borders, not shadows.
**Action:** When styling buttons, avoid `shadowColor`, `shadowOpacity`, `shadowRadius`, or `elevation`. Rely on background colors (like `COLORS.accent`), borders, and active/hover states for interaction affordance.
