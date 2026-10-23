import type { OngoingGame } from "@glichess/shared"
import { useEffect, useState } from "react"

import { useSession } from "@/lib/session"
import { socket } from "@/lib/socket"

export interface OngoingGames {
  games: OngoingGame[]
  /** serverTime - clientTime when the list arrived, for countdowns. */
  offset: number
}

/**
 * The user's games in progress. Fetched on every (re)connect and when the signed-in user
 * changes; the server pushes a new list whenever a game starts, ends or is left.
 */
export function useOngoingGames(): OngoingGames {
  const { user } = useSession()
  const [state, setState] = useState<OngoingGames>({ games: [], offset: 0 })
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let active = true
    const apply = (games: OngoingGame[]) => {
      if (!active) return
      const serverNow = games[0]?.serverNow
      setState({ games, offset: serverNow === undefined ? 0 : serverNow - Date.now() })
    }
    const load = () => {
      socket.emit("game:ongoing", (res) => {
        if (res.ok) apply(res.data)
      })
    }

    socket.on("game:ongoing", apply)
    socket.on("connect", load)
    if (socket.connected) load()
    return () => {
      active = false
      socket.off("game:ongoing", apply)
      socket.off("connect", load)
    }
  }, [userId])

  return state
}
