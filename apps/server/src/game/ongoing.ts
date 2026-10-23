import type { GameSnapshot } from "@glichess/shared"

import { userRoom, type IoServer } from "../realtime"
import { gameManager } from "./index"

/**
 * Keeps every player's "game in progress" link current. Most snapshots are just moves, so the
 * players' lists are only re-sent when a game starts or ends, or a player leaves or comes back
 * (which starts or cancels their abandonment countdown).
 */
export function createOngoingNotifier(io: IoServer) {
  /** Per active game: the last status and abandonment deadline the players were told about. */
  const sent = new Map<string, string>()

  return (snapshot: GameSnapshot) => {
    const active = snapshot.status === "active"
    const key = `${snapshot.status}:${snapshot.abandonDeadline?.at ?? ""}`
    if (active ? sent.get(snapshot.id) === key : !sent.has(snapshot.id)) return
    if (active) sent.set(snapshot.id, key)
    else sent.delete(snapshot.id)

    for (const player of [snapshot.white, snapshot.black]) {
      if (player)
        io.to(userRoom(player.id)).emit("game:ongoing", gameManager.ongoingGames(player.id))
    }
  }
}
