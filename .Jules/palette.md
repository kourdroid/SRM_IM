2023-11-20 - [Incident Type Badge Pattern]
Learning: The field agent app and admin views must share the same component structure for semantic badges. The typeBadge requires a distinct visual container (backgroundColor: '#F3F4F6', paddingHorizontal: 8) rather than just being formatted text. The design system explicitly bans the 500 font weight and using monospace families.
Action: Enforce the 'Weight Ladder Rule' and use the standard `typeBadge` View wrapper across all lists displaying Incident types.
2024-05-21 - [Typography Weight Restrictions]
Learning: The design system mandates a strict 'Weight Ladder Rule' allowing only 400, 600, 700, and 800/900 font weights. The 500 weight is explicitly forbidden as it blurs visual hierarchy. Several existing components mistakenly used 500.
Action: Automatically replace all instances of fontWeight: '500' with fontWeight: '600' to align with the allowed scale and enforce the strict typographical hierarchy.
