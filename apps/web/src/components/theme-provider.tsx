import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  isTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme"

const darkQuery = "(prefers-color-scheme: dark)"

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(value)) return value
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
  return "system"
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(darkQuery).matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)

  useEffect(() => {
    const media = window.matchMedia(darkQuery)
    const onChange = () => setSystem(media.matches ? "dark" : "light")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme = theme === "system" ? system : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        setThemeState(next)
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next)
        } catch {
          // Ignore; the choice still applies for this session.
        }
      },
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
