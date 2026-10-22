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
        <output className="flex size-8 items-center justify-center gap-2 rounded-md border font-mono text-xs text-muted-foreground sm:w-auto sm:px-2.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "connected" && "bg-success",
              status === "connecting" && "animate-pulse bg-signal",
              status === "disconnected" && "bg-destructive",
            )}
          />
          <span className="hidden tabular-nums sm:inline">
            {status === "connected" && latency !== null ? `${latency}ms` : labels[status]}
          </span>
        </output>
      </TooltipTrigger>
      <TooltipContent>Realtime server: {labels[status].toLowerCase()}</TooltipContent>
    </Tooltip>
  )
}
