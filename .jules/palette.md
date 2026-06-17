## 2024-05-24 - Fix Status Badges Styles
**Learning:** Status badges for 'Open' and 'Closed' incidents currently feature a 1px border. According to the DESIGN.md specifications, these badges must use a tinted background without borders, and only 'Reclamation' status badges should feature a border.
**Action:** Removing the borderWidth and borderColor properties from the styles of these specific badges across the app to align with the design guidelines.
