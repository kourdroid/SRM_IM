2023-11-20 - [Incident Type Badge Pattern]
Learning: The field agent app and admin views must share the same component structure for semantic badges. The typeBadge requires a distinct visual container (backgroundColor: '#F3F4F6', paddingHorizontal: 8) rather than just being formatted text. The design system explicitly bans the 500 font weight and using monospace families.
Action: Enforce the 'Weight Ladder Rule' and use the standard `typeBadge` View wrapper across all lists displaying Incident types.
2026-09-16 - [Type Badge Container Pattern]
Learning: When adding semantic badges like type badges, always wrap the text in a container View with appropriate padding and background color. Do not render them as plain formatted text, and ensure the font weight strictly adheres to the Weight Ladder Rule.
Action: Apply the consistent badge wrapper structure and styling across list item and modal headers.
