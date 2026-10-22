import { useEffect, useState, useSyncExternalStore } from "react"
import { connectionStore, socket } from "@/lib/socket"

export function useConnectionStatus() {
  return useSyncExternalStore(connectionStore.subscribe, connectionStore.getSnapshot)
}

/** Round-trip time to the server in ms, sampled every `intervalMs`. `null` until measured or while offline. */
export function useLatency(intervalMs = 5000) {
  const status = useConnectionStatus()
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    if (status !== "connected") return

    let cancelled = false
    const measure = () => {
      const startedAt = performance.now()
      socket.timeout(3000).emit("system:ping", (err) => {
        if (!cancelled) setLatency(err ? null : Math.round(performance.now() - startedAt))
      })
    }

    measure()
    const id = setInterval(measure, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [status, intervalMs])

  return status === "connected" ? latency : null
}
