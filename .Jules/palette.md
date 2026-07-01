2023-11-20 - [Incident Type Badge Pattern]
Learning: The field agent app and admin views must share the same component structure for semantic badges. The typeBadge requires a distinct visual container (backgroundColor: '#F3F4F6', paddingHorizontal: 8) rather than just being formatted text. The design system explicitly bans the 500 font weight and using monospace families.
Action: Enforce the 'Weight Ladder Rule' and use the standard `typeBadge` View wrapper across all lists displaying Incident types.
2023-11-20 - [Incident Card Badge Pattern]
Learning: The field agent app (director view) requires `typeBadge` and `statusBadge` to use `<View>` wrappers for backgrounds and padding, and explicitly apply `TYPOGRAPHY.labelUppercase` to the nested text elements instead of manually setting `textTransform: 'uppercase'`, enforcing the Weight Ladder Rule.
Action: Always separate container styles from text styles for badges and use `TYPOGRAPHY.labelUppercase` to ensure correct typographic hierarchy.
