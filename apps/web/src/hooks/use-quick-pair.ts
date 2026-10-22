import type { TimeControlId } from "@glichess/shared"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { ackError, socket } from "@/lib/socket"

/** Joins the matchmaking queue for a time control and opens the game once paired. */
export function useQuickPair() {
  const navigate = useNavigate()
  const [searching, setSearching] = useState<TimeControlId | null>(null)

  useEffect(() => {
    const onMatched = ({ gameId }: { gameId: string }) => {
      setSearching(null)
      void navigate(`/game/${gameId}`)
    }
    socket.on("queue:matched", onMatched)
    return () => {
      socket.off("queue:matched", onMatched)
    }
  }, [navigate])

  // The server forgets the search on disconnect, so rejoin after reconnecting; leave when unmounted.
  useEffect(() => {
    if (!searching) return
    const join = () => {
      socket.timeout(10_000).emit("queue:join", { timeControlId: searching }, (err, res) => {
        const error = ackError(err, res)
        if (error) {
          toast.error(error)
          setSearching(null)
        }
      })
    }
    if (socket.connected) join()
    socket.on("connect", join)
    return () => {
      socket.off("connect", join)
      if (socket.connected) socket.emit("queue:leave")
    }
  }, [searching])

  const toggle = useCallback(
    (id: TimeControlId) => setSearching((current) => (current === id ? null : id)),
    [],
  )

  return { searching, toggle }
}
