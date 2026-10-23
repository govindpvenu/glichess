import type { MoveRecord } from "@glichess/shared"

import { cn } from "@/lib/utils"

export function MoveList({ moves }: { moves: MoveRecord[] }) {
  const rows = Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => ({
    number: i + 1,
    white: moves[i * 2],
    black: moves[i * 2 + 1],
  }))

  if (moves.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No moves yet.</p>
  }

  const last = moves.length - 1
  return (
    <ol
      aria-label="Move list"
      // Keep the latest move in view without scrolling the page.
      ref={(list) => {
        if (list) list.scrollTop = list.scrollHeight
      }}
      className="max-h-full overflow-y-auto p-2 font-mono text-sm"
    >
      {rows.map((row, i) => (
        <li
          key={row.number}
          className="grid grid-cols-[2.5rem_1fr_1fr] rounded px-2 py-1 even:bg-muted/50"
        >
          <span className="text-muted-foreground">{row.number}.</span>
          <span className={cn(i * 2 === last && "font-semibold text-signal")}>
            {row.white?.san}
          </span>
          <span className={cn(i * 2 + 1 === last && "font-semibold text-signal")}>
            {row.black?.san}
          </span>
        </li>
      ))}
    </ol>
  )
}
