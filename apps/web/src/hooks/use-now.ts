import { useEffect, useState } from "react"

/** Current time, re-rendering every `intervalMs` while `enabled`. */
export function useNow(enabled: boolean, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
  return now
}

/** Milliseconds left until a server timestamp, corrected by the server clock offset. */
export function useCountdown(serverDeadline: number | null, offset: number) {
  const now = useNow(serverDeadline !== null, 250)
  return serverDeadline === null ? null : Math.max(0, serverDeadline - (now + offset))
}
