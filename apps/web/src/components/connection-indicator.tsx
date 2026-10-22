import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConnectionStatus, useLatency } from "@/hooks/use-connection"
import { cn } from "@/lib/utils"

const labels = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Offline",
} as const

export function ConnectionIndicator() {
  const status = useConnectionStatus()
  const latency = useLatency()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          className="flex h-8 items-center gap-2 rounded-md border px-2.5 font-mono text-xs text-muted-foreground"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "connected" && "bg-success",
              status === "connecting" && "animate-pulse bg-signal",
              status === "disconnected" && "bg-destructive",
            )}
          />
          <span className="tabular-nums">
            {status === "connected" && latency !== null ? `${latency}ms` : labels[status]}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>Realtime server: {labels[status].toLowerCase()}</TooltipContent>
    </Tooltip>
  )
}
