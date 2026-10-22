import { otherColor, type Color, type GameSnapshot } from "@glichess/shared"

import { useCountdown } from "@/hooks/use-now"
import { describeResult, formatSeconds } from "@/lib/format"
import { cn } from "@/lib/utils"

/** One line describing what is happening now: whose move, countdowns, or the result. */
export function GameStatus({
  snapshot,
  offset,
  myColor,
}: {
  snapshot: GameSnapshot
  offset: number
  myColor: Color | null
}) {
  const firstMoveLeft = useCountdown(snapshot.firstMoveDeadline, offset)
  const abandonLeft = useCountdown(snapshot.abandonDeadline?.at ?? null, offset)
  const result = describeResult(snapshot)

  if (result) {
    return (
      <div>
        <p className="text-lg font-semibold tracking-tight">{result.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p>
      </div>
    )
  }

  if (snapshot.status === "waiting") {
    return <p className="text-sm text-muted-foreground">Waiting for an opponent to join.</p>
  }

  const turn: Color = snapshot.moves.length % 2 === 0 ? "white" : "black"
  const yourTurn = turn === myColor
  const abandon = snapshot.abandonDeadline

  return (
    <div className="space-y-1.5 text-sm">
      <p className={cn("font-medium", yourTurn && "text-signal")}>
        {yourTurn ? "Your move" : `${turn === "white" ? "White" : "Black"} to move`}
      </p>
      {firstMoveLeft !== null && (
        <p className="text-muted-foreground">
          {yourTurn ? "Make your first move" : "Waiting for the first move"} ·{" "}
          <span className="font-mono tabular-nums">{formatSeconds(firstMoveLeft)}</span> before the
          game is aborted
        </p>
      )}
      {abandon && abandonLeft !== null && (
        <p className="text-muted-foreground">
          {abandon.color === myColor
            ? "You are disconnected"
            : `${myColor && abandon.color === otherColor(myColor) ? "Your opponent" : "A player"} left`}{" "}
          · forfeits in <span className="font-mono tabular-nums">{formatSeconds(abandonLeft)}</span>
        </p>
      )}
    </div>
  )
}
