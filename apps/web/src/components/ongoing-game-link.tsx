import { Link, useMatch } from "react-router"

import { useCountdown } from "@/hooks/use-now"
import type { OngoingGames } from "@/hooks/use-ongoing-games"
import { formatSeconds } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Shown on every page except the game itself while the user is playing: a way back to the board,
 * with the time left before they forfeit for having left it. A pill in the header on wide
 * screens, a strip under it on phones.
 */
export function OngoingGameLink({
  ongoing: { games, offset },
  variant,
}: {
  ongoing: OngoingGames
  variant: "pill" | "strip"
}) {
  const current = useMatch("/game/:gameId")?.params.gameId
  const game = games.find((g) => g.gameId !== current) ?? null
  const left = useCountdown(game?.abandonAt ?? null, offset)

  if (!game) return null
  const opponent = game.opponent?.name ?? "your opponent"
  const label = left === null ? "Game in progress" : `Back to game · ${formatSeconds(left)}`

  return (
    <Link
      to={`/game/${game.gameId}`}
      aria-label={`Game in progress against ${opponent}. Return to the game`}
      title={`${game.timeControlId} against ${opponent}`}
      className={cn(
        "flex items-center gap-2 text-sm font-medium transition-colors",
        variant === "pill"
          ? "h-8 rounded-md border border-signal/40 bg-signal/10 px-3 hover:bg-signal/15"
          : "border-t border-signal/30 bg-signal/10 px-4 py-2 sm:px-6",
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-60" />
        <span className="relative size-2 rounded-full bg-signal" />
      </span>
      <span className={cn(left !== null && "text-signal tabular-nums")}>{label}</span>
      {variant === "strip" && (
        <span className="ml-auto truncate text-muted-foreground">
          vs {opponent} · {game.timeControlId}
        </span>
      )}
    </Link>
  )
}
