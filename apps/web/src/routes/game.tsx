import { otherColor, type Color } from "@glichess/shared"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router"

import { GameActions } from "@/components/game/game-actions"
import { GameBoard } from "@/components/game/game-board"
import { GameStatus } from "@/components/game/game-status"
import { InvitePanel } from "@/components/game/invite-panel"
import { MoveList } from "@/components/game/move-list"
import { PlayerBar } from "@/components/game/player-bar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGame } from "@/hooks/use-game"

/** Route entry: remounts the page per game so state never leaks between games (e.g. rematches). */
export function GameRoute() {
  const { gameId = "" } = useParams()
  return <GamePage key={gameId} gameId={gameId} />
}

function GamePage({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const { view, error, myColor, actions } = useGame(gameId)
  const [flipped, setFlipped] = useState(false)
  const rematchId = view?.snapshot.rematchGameId

  useEffect(() => {
    if (rematchId && myColor) void navigate(`/game/${rematchId}`)
  }, [rematchId, myColor, navigate])

  if (error && !view) return <GameNotFound message={error} />
  if (!view) return <GameSkeleton />

  const { snapshot, offset } = view
  const base: Color = myColor ?? "white"
  const bottom = flipped ? otherColor(base) : base
  const top = otherColor(bottom)
  const playing = snapshot.status === "active" ? myColor : null
  const lastMove = snapshot.moves.at(-1)?.uci ?? null

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="mx-auto flex w-full max-w-[min(100%,calc(100svh-13rem))] flex-col gap-3">
        <PlayerBar snapshot={snapshot} color={top} offset={offset} isYou={top === myColor} />
        <GameBoard
          fen={snapshot.fen}
          orientation={bottom}
          playerColor={playing}
          lastMove={lastMove}
          onMove={actions.move}
        />
        <PlayerBar snapshot={snapshot} color={bottom} offset={offset} isYou={bottom === myColor} />
      </section>

      <aside className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100svh-7rem)]">
        <Panel
          title="Game"
          meta={`${snapshot.timeControl.id} · ${snapshot.rated ? "Rated" : "Casual"}`}
        >
          <div className="space-y-4 p-4">
            <GameStatus snapshot={snapshot} offset={offset} myColor={myColor} />
            {snapshot.status === "waiting" ? (
              <>
                <InvitePanel gameId={snapshot.id} />
                <Button variant="outline" size="sm" className="w-full" onClick={actions.abort}>
                  Cancel invite
                </Button>
              </>
            ) : (
              <GameActions
                snapshot={snapshot}
                myColor={myColor}
                actions={actions}
                onFlip={() => setFlipped((f) => !f)}
              />
            )}
          </div>
        </Panel>

        <Panel title="Moves" meta={`${snapshot.moves.length} ply`} className="min-h-40 flex-1">
          <MoveList moves={snapshot.moves} />
        </Panel>
      </aside>
    </div>
  )
}

function Panel({
  title,
  meta,
  className,
  children,
}: {
  title: string
  meta?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`flex min-h-0 flex-col rounded-lg border bg-card ${className ?? ""}`}>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="label-mono">{title}</h2>
        {meta && <span className="label-mono">{meta}</span>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

function GameSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100svh-13rem))] flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function GameNotFound({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="label-mono">Game</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{message}</h1>
      <p className="mt-3 text-muted-foreground">
        The link may be wrong, or the invite was cancelled.
      </p>
      <Button asChild className="mt-8">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  )
}
