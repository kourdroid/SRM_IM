## 2024-06-08 - The Status Truth Rule
**Learning:** The "Safety Vest Palette" restricts the Electric Lime accent color strictly to CTAs and active states. Status indicators must never use Lime; they must strictly use the semantic signal colors (Red for open/error, Green for resolved/success). Furthermore, Open incidents are exclusively Red, not Orange (which is reserved for reclamations).
**Action:** When styling status dots or badges, always verify they map to the correct `COLORS.signal*` value and avoid using `COLORS.accent` or hardcoded orange hex codes for standard open states.
