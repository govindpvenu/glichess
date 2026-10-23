import { otherColor, type Color } from "@glichess/shared"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router"

import { CallPanel } from "@/components/game/call-panel"
import { ChatPanel } from "@/components/game/chat-panel"
import { GameActions } from "@/components/game/game-actions"
import { GameBoard } from "@/components/game/game-board"
import { GameStatus } from "@/components/game/game-status"
import { InvitePanel } from "@/components/game/invite-panel"
import { MoveList } from "@/components/game/move-list"
import { PlayerBar } from "@/components/game/player-bar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCall } from "@/hooks/use-call"
import { useChat } from "@/hooks/use-chat"
import { useGame } from "@/hooks/use-game"
import { useGameEvents } from "@/hooks/use-game-events"
import { useGameSounds } from "@/hooks/use-game-sounds"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMuted } from "@/hooks/use-muted"
import { saveCallPrefs } from "@/lib/call/prefs"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

/** Route entry: remounts the page per game so state never leaks between games (e.g. rematches). */
export function GameRoute() {
  const { gameId = "" } = useParams()
  return <GamePage key={gameId} gameId={gameId} />
}

function GamePage({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const { view, error, myColor, actions } = useGame(gameId)
  const snapshot = view?.snapshot ?? null
  const [flipped, setFlipped] = useState(false)
  const call = useCall(gameId, myColor, snapshot?.source ?? null)
  const wide = useMediaQuery("(min-width: 80rem)")
  const narrow = !useMediaQuery("(min-width: 64rem)")
  const [tab, setTab] = useState<Tab>("moves")
  const [unread, setUnread] = useState(0)
  const chatVisible = !narrow || tab === "chat"

  const opponent = myColor && snapshot ? snapshot[otherColor(myColor)] : null
  const [muted, setMuted] = useMuted(opponent?.id ?? null)
  const chat = useChat(gameId, myColor !== null, (message) => {
    if (!opponent || message.userId !== opponent.id || muted) return
    playSound("message")
    if (!chatVisible) setUnread((n) => n + 1)
  })
  const events = useGameEvents(snapshot, view?.offset ?? 0)
  useGameSounds(snapshot)

  const callSession = call.session
  const rematchId = snapshot?.rematchGameId

  useEffect(() => {
    if (!rematchId || !myColor) return
    // The rematch keeps the camera and mic as they are now.
    const { audio, video } = callSession.getSnapshot()
    saveCallPrefs(rematchId, { audio, video })
    playSound("notify")
    void navigate(`/game/${rematchId}`)
  }, [rematchId, myColor, navigate, callSession])

  if (error && !view) return <GameNotFound message={error} />
  if (!view || !snapshot) return <GameSkeleton />

  const { offset } = view
  const base: Color = myColor ?? "white"
  const bottom = flipped ? otherColor(base) : base
  const top = otherColor(bottom)
  const playing = snapshot.status === "active" ? myColor : null
  const lastMove = snapshot.moves.at(-1)?.uci ?? null

  const callPanel = myColor && (
    <CallPanel
      snapshot={snapshot}
      myColor={myColor}
      session={call.session}
      state={call.state}
      compact={narrow}
    />
  )
  const muteButton = opponent && (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={`${muted ? "Unmute" : "Mute"} ${opponent.name}`}
      title={`${muted ? "Show" : "Hide"} ${opponent.name}'s messages`}
      className="label-mono transition-colors hover:text-foreground"
    >
      {muted ? "Unmute" : "Mute"}
    </button>
  )
  const chatPanel = (
    <ChatPanel
      snapshot={snapshot}
      myColor={myColor}
      messages={chat.messages}
      events={events}
      muted={muted}
      onSend={chat.send}
    />
  )
  const movesPanel = <MoveList moves={snapshot.moves} />

  const board = (
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
  )

  const gamePanel = (
    <Panel
      title="Game"
      className="shrink-0"
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
  )

  // Phones: the call sits above the board, and moves and chat share tabs below it.
  if (narrow) {
    return (
      <div className="mx-auto grid max-w-xl grid-cols-1 gap-4 px-4 py-4 sm:px-6">
        {callPanel}
        {board}
        {gamePanel}
        <TabbedPanel
          tab={tab}
          onTab={(next) => {
            setTab(next)
            if (next === "chat") setUnread(0)
          }}
          unread={unread}
          action={tab === "chat" && muteButton}
          panels={{ moves: movesPanel, chat: chatPanel }}
          movesMeta={`${snapshot.moves.length} ply`}
        />
      </div>
    )
  }

  const chatSection = (
    <Panel title="Chat" action={muteButton} className="h-80 lg:h-auto lg:min-h-56 lg:flex-[1.4]">
      {chatPanel}
    </Panel>
  )

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_320px] gap-6 px-6 py-6 xl:max-w-[88rem] xl:grid-cols-[18rem_minmax(0,1fr)_19rem]">
      {/* Wide screens: call and chat get their own column left of the board, as on lichess. */}
      {wide && (
        <aside className={asideClass}>
          {callPanel}
          {chatSection}
        </aside>
      )}

      {board}

      <aside className={asideClass}>
        {!wide && callPanel}
        {gamePanel}
        <Panel title="Moves" meta={`${snapshot.moves.length} ply`} className="min-h-32 flex-1">
          {movesPanel}
        </Panel>
        {!wide && chatSection}
      </aside>
    </div>
  )
}

type Tab = "moves" | "chat"

function TabbedPanel({
  tab,
  onTab,
  unread,
  action,
  panels,
  movesMeta,
}: {
  tab: Tab
  onTab: (tab: Tab) => void
  unread: number
  action: ReactNode
  panels: Record<Tab, ReactNode>
  movesMeta: string
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "moves", label: "Moves" },
    { id: "chat", label: "Chat" },
  ]

  return (
    <section className="flex h-[26rem] flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-5 border-b px-4">
        <div role="tablist" aria-label="Moves and chat" className="flex gap-5">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => onTab(id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b py-3 label-mono transition-colors",
                tab === id
                  ? "border-foreground text-foreground"
                  : "border-transparent hover:text-foreground",
              )}
            >
              {label}
              {id === "chat" && unread > 0 && tab !== "chat" && (
                <span
                  aria-label={`${unread} unread`}
                  className="grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[0.625rem] tracking-normal text-signal-foreground"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          {tab === "moves" ? <span className="label-mono">{movesMeta}</span> : action}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1"
      >
        {panels[tab]}
      </div>
    </section>
  )
}

/** Side columns fill the viewport height and scroll as a whole if their panels don't fit. */
const asideClass = "flex min-h-0 flex-col gap-4 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto"

function Panel({
  title,
  meta,
  action,
  className,
  children,
}: {
  title: string
  meta?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`flex min-h-0 flex-col rounded-lg border bg-card ${className ?? ""}`}>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="label-mono">{title}</h2>
        {meta && <span className="label-mono">{meta}</span>}
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

function GameSkeleton() {
  return (
    <div className="mx-auto grid max-w-xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:py-6 xl:max-w-[88rem] xl:grid-cols-[18rem_minmax(0,1fr)_19rem]">
      <Skeleton className="hidden h-64 w-full xl:block" />
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
