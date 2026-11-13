import { createContext, useContext } from "react"

/** User preference: an explicit theme, or follow the operating system. */
export type Theme = "light" | "dark" | "system"

/** The theme actually applied to the page. */
export type ResolvedTheme = "light" | "dark"

export type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Reads the theme preference; must be used inside ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme doit être utilisé à l'intérieur de <ThemeProvider>.")
  }
  return context
}
