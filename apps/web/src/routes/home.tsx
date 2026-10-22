import { TIME_CONTROLS } from "@glichess/shared"
import { LoaderCircle } from "lucide-react"

import { PlayFriendDialog } from "@/components/play-friend-dialog"
import { useConnectionStatus } from "@/hooks/use-connection"
import { useQuickPair } from "@/hooks/use-quick-pair"
import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"

const categoryLabel = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid" } as const

export function HomePage() {
  const { user } = useSession()
  const { searching, toggle } = useQuickPair()
  // Requests sent before the socket is up would be lost, so wait for the connection.
  const ready = useConnectionStatus() === "connected"

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="max-w-2xl">
        <p className="label-mono">Realtime chess</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Play face to face.
        </h1>
        <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
          Live games with video, voice and chat on one screen. No account needed to start.
        </p>
      </section>

      <section className="mt-12 rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="label-mono">Quick pair</h2>
          <span className="label-mono">
            {user?.isGuest ? "Casual" : "Rated vs signed-in players"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          {TIME_CONTROLS.map((tc) => {
            const active = searching === tc.id
            return (
              <button
                key={tc.id}
                type="button"
                aria-pressed={active}
                disabled={!ready}
                onClick={() => toggle(tc.id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-md border px-4 py-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  active
                    ? "border-signal bg-signal/10"
                    : "bg-background enabled:hover:border-foreground/30 enabled:hover:bg-accent",
                )}
              >
                <span className="font-mono text-2xl font-medium tracking-tight tabular-nums">
                  {tc.id}
                </span>
                <span
                  className={cn("flex items-center gap-1.5 label-mono", active && "text-signal")}
                >
                  {active && <LoaderCircle className="size-3 animate-spin" />}
                  {active ? "Searching · tap to cancel" : categoryLabel[tc.category]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Or create a private game and send the link to a friend.
          </p>
          <PlayFriendDialog />
        </div>
      </section>
    </div>
  )
}
