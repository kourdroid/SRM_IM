
## 2024-05-24 - Status Indication Consistency
**Learning:** The open incident status is currently styled with an Orange color/tint on the home screen modal and dot, instead of strictly using Red for open statuses as dictated by the 'The Status Truth Rule' which states: 'Red = open, green = resolved, orange = reclamation'. The dot on the list item uses orange for open, and accent for closed, which is completely backwards. Open should be red, closed green. Also the modal details for an open incident use an orange background and border.
**Action:** When adjusting status badges or indicators, ensure 'open' always uses `COLORS.signalRed` and its associated tints. Remove hardcoded `rgba(249, 115, 22, X)` orange colors for open statuses.
