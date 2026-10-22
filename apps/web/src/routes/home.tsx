import { TIME_CONTROLS } from "@glichess/shared"
import { Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"

const categoryLabel = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid" } as const

export function HomePage() {
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
          <span className="label-mono">Available soon</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              type="button"
              disabled
              className="group flex flex-col items-start gap-2 rounded-md border bg-background px-4 py-5 text-left transition-colors enabled:hover:border-foreground/30 enabled:hover:bg-accent disabled:cursor-not-allowed"
            >
              <span className="font-mono text-2xl font-medium tracking-tight tabular-nums">
                {tc.id}
              </span>
              <span className="label-mono">{categoryLabel[tc.category]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Or create a private game and send the link to a friend.
          </p>
          <Button variant="outline" disabled>
            <Link2 />
            Play a friend
          </Button>
        </div>
      </section>
    </div>
  )
}
