import { NavLink } from "react-router"
import { ConnectionIndicator } from "@/components/connection-indicator"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const upcoming = ["Puzzles", "Leaderboard"]

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm sm:flex">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn("transition-colors", isActive ? "text-foreground" : "text-muted-foreground")
            }
          >
            Play
          </NavLink>
          {upcoming.map((item) => (
            <span
              key={item}
              className="cursor-default text-muted-foreground/60"
              title="Coming soon"
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionIndicator />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
