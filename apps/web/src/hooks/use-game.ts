import type { AckResult, Color, DrawAction, GameSnapshot, RematchAction } from "@glichess/shared"
import { Chess } from "chess.js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/lib/session"
import { ACK_TIMEOUT_MS, ackError, socket } from "@/lib/socket"

export interface GameView {
  snapshot: GameSnapshot
  /** serverTime - clientTime when the snapshot arrived; corrects clocks for client clock skew. */
  offset: number
}

/** Returns true on success; shows the error otherwise. */
function settle(err: Error | null, res: AckResult | undefined) {
  const error = ackError(err, res)
  if (error) toast.error(error)
  return !error
}

/**
 * Subscribes to one game: joins it (and re-joins after every reconnect), keeps the latest
 * server snapshot, and exposes the player's actions. Moves are shown optimistically.
 */
export function useGame(gameId: string) {
  const { user } = useSession()
  const [view, setView] = useState<GameView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rejoin = useRef<() => void>(() => {})

  useEffect(() => {
    let active = true
    const apply = (snapshot: GameSnapshot) => {
      if (active && snapshot.id === gameId) {
        setView({ snapshot, offset: snapshot.serverNow - Date.now() })
      }
    }
    const join = () => {
      socket.emit("game:join", { gameId }, (res) => {
        if (!active) return
        if (res.ok) {
          apply(res.data)
          setError(null)
        } else {
          setError(res.error)
        }
      })
    }

    rejoin.current = join
    socket.on("game:update", apply)
    socket.on("connect", join)
    if (socket.connected) join()
    return () => {
      active = false
      socket.off("game:update", apply)
      socket.off("connect", join)
      if (socket.connected) socket.emit("game:leave", { gameId })
    }
  }, [gameId])

  const snapshot = view?.snapshot ?? null
  const myColor: Color | null =
    !user || !snapshot
      ? null
      : snapshot.white?.id === user.id
        ? "white"
        : snapshot.black?.id === user.id
          ? "black"
          : null

  /** Fetches a fresh snapshot, e.g. after the server rejected an optimistic move. */
  const resync = useCallback(() => rejoin.current(), [])

  const move = useCallback(
    (uci: string) => {
      if (!snapshot) return
      const chess = new Chess(snapshot.fen)
      let played
      try {
        played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      } catch {
        return
      }
      const ply = snapshot.moves.length
      // Show the move immediately; the server's snapshot (a few ms later) is authoritative.
      setView(
        (current) =>
          current && {
            ...current,
            snapshot: {
              ...current.snapshot,
              fen: chess.fen(),
              moves: [...current.snapshot.moves, { san: played.san, uci: played.lan, clockMs: 0 }],
            },
          },
      )
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit("game:move", { gameId, uci: played.lan, ply }, (err, res) => {
          if (!settle(err, res)) resync()
        })
    },
    [gameId, snapshot, resync],
  )

  const actions = useMemo(
    () => ({
      move,
      resign: () =>
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit("game:resign", { gameId }, (err, res) => settle(err, res)),
      abort: () =>
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit("game:abort", { gameId }, (err, res) => settle(err, res)),
      draw: (action: DrawAction) =>
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit("game:draw", { gameId, action }, (err, res) => settle(err, res)),
      rematch: (action: RematchAction) =>
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit("game:rematch", { gameId, action }, (err, res) => settle(err, res)),
    }),
    [gameId, move],
  )

  return { view, error, myColor, actions }
}
