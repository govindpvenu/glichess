import { createContext, useContext } from "react"

export const THEMES = ["light", "dark", "system"] as const
export type Theme = (typeof THEMES)[number]
export type ResolvedTheme = "light" | "dark"

/** Must match the key read by public/theme-init.js. */
export const THEME_STORAGE_KEY = "glichess-theme"

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}
