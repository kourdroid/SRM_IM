2023-11-20 - [Incident Type Badge Pattern]
Learning: The field agent app and admin views must share the same component structure for semantic badges. The typeBadge requires a distinct visual container (backgroundColor: '#F3F4F6', paddingHorizontal: 8) rather than just being formatted text. The design system explicitly bans the 500 font weight and using monospace families.
Action: Enforce the 'Weight Ladder Rule' and use the standard `typeBadge` View wrapper across all lists displaying Incident types.
