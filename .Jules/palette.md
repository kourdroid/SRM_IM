2025-02-12 - [Empty States in React Native]

Learning: The current app uses plain text ("Aucun incident trouvé") for its empty state on the Home screen. This lacks visual hierarchy and feels unfinished. In React Native apps, empty states should be styled to provide a premium feel, typically including a relevant icon, a clear title, and a descriptive subtitle to guide the user.
Action: Enhance the ListEmptyComponent with an icon (e.g., from Ionicons), an uppercase title, and a lighter subtitle for better visual rhythm and context.