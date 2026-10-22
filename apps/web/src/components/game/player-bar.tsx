import type { Color, GamePlayer, GameSnapshot } from "@glichess/shared"

import { UserAvatar } from "@/components/user-avatar"
import { useNow } from "@/hooks/use-now"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

const LOW_TIME_MS = 20_000

export function PlayerBar({
  snapshot,
  color,
  offset,
  isYou,
}: {
  snapshot: GameSnapshot
  color: Color
  offset: number
  isYou: boolean
}) {
  const player = snapshot[color]
  const connected = snapshot.connected[color]

  return (
    <div className="flex w-full items-center gap-3">
      {player ? (
        <UserAvatar user={player} size="lg" />
      ) : (
        <div className="size-10 rounded-md border border-dashed" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">
            {player ? player.name : "Waiting for opponent"}
          </span>
          {player && <Rating player={player} />}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {player && (
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-success" : "bg-muted-foreground/40",
              )}
              title={connected ? "Online" : "Offline"}
            />
          )}
          <span className={cn("label-mono", isYou && "text-signal")}>
            {isYou ? "You" : player?.isGuest ? "Guest" : color}
          </span>
        </div>
      </div>
      <Clock snapshot={snapshot} color={color} offset={offset} />
    </div>
  )
}

function Rating({ player }: { player: GamePlayer }) {
  if (player.rating === null) return null
  const diff = player.ratingDiff
  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {player.rating}
      {diff !== null && (
        <span className={cn("ml-1", diff > 0 && "text-success", diff < 0 && "text-destructive")}>
          {diff > 0 ? `+${diff}` : diff === 0 ? "±0" : diff}
        </span>
      )}
    </span>
  )
}

function Clock({
  snapshot,
  color,
  offset,
}: {
  snapshot: GameSnapshot
  color: Color
  offset: number
}) {
  const { clock } = snapshot
  const running = clock.running === color && clock.runningSince !== null
  const now = useNow(running)
  const stored = color === "white" ? clock.whiteMs : clock.blackMs
  // `now` can be slightly stale right after the clock starts; never show more than the stored time.
  const remaining = running
    ? Math.min(stored, stored - (now + offset - clock.runningSince!))
    : stored
  const low = remaining < LOW_TIME_MS && snapshot.status === "active"

  return (
    <div
      role="timer"
      aria-label={`${color} clock`}
      className={cn(
        "min-w-24 rounded-md border px-3 py-2 text-right font-mono text-2xl font-medium tracking-tight tabular-nums transition-colors",
        running
          ? "border-signal bg-signal text-signal-foreground"
          : "bg-card text-muted-foreground",
        low && running && "border-destructive bg-destructive text-white",
        low && !running && "text-destructive",
      )}
    >
      {formatClock(remaining)}
    </div>
  )
}
