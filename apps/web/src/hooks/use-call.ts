import type { Color, GameSource } from "@glichess/shared"
import { useEffect, useState, useSyncExternalStore } from "react"

import { CallSession } from "@/lib/call/call-session"
import { defaultMedia, loadCallPrefs } from "@/lib/call/prefs"

/**
 * The game's video call. Runs only for the two players, once both are seated (`myColor` is null
 * for spectators and while an invite is open).
 */
export function useCall(gameId: string, myColor: Color | null, source: GameSource | null) {
  const [session] = useState(() => new CallSession(gameId))
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)

  useEffect(() => {
    if (!myColor || !source) return
    session.start(myColor, loadCallPrefs(gameId) ?? defaultMedia(source))
    return () => session.stop()
  }, [session, gameId, myColor, source])

  return { session, state }
}
