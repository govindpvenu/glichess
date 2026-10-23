import { useCallback, useState } from "react"

const STORAGE_KEY = "glichess-muted"

function load(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []
  } catch {
    return []
  }
}

/** Whether you have muted a player's chat. Kept in this browser, so it lasts into rematches. */
export function useMuted(userId: string | null) {
  const [ids, setIds] = useState(load)

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!userId) return
      // Re-read so another tab's changes aren't overwritten; keep the list from growing forever.
      const next = load().filter((id) => id !== userId)
      if (muted) next.push(userId)
      const kept = next.slice(-200)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
      } catch {
        // Storage blocked: the mute lasts until the page closes.
      }
      setIds(kept)
    },
    [userId],
  )

  return [userId !== null && ids.includes(userId), setMuted] as const
}
