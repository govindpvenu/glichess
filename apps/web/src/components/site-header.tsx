import { NavLink, useMatch } from "react-router"

import { ConnectionIndicator } from "@/components/connection-indicator"
import { Logo } from "@/components/logo"
import { OngoingGameLink } from "@/components/ongoing-game-link"
import { SoundToggle } from "@/components/sound-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { useOngoingGames } from "@/hooks/use-ongoing-games"
import { cn } from "@/lib/utils"

const upcoming = ["Puzzles", "Leaderboard"]

export function SiteHeader() {
  // The game page spreads to three columns on wide screens; keep the header aligned with it.
  const wide = useMatch("/game/:gameId") !== null
  const ongoing = useOngoingGames()
  return (
    <header className="border-b">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-6",
          wide && "xl:max-w-[88rem]",
        )}
      >
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
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <OngoingGameLink ongoing={ongoing} variant="pill" />
          </div>
          <ConnectionIndicator />
          <SoundToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <div className="sm:hidden">
        <OngoingGameLink ongoing={ongoing} variant="strip" />
      </div>
    </header>
  )
}
