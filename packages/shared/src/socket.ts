import type { ColorPreference, GameSnapshot } from "./game"
import type { TimeControlId } from "./time-control"
import type { PublicUser } from "./user"

export type AckResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }
export type Ack<T = undefined> = (result: AckResult<T>) => void

export type DrawAction = "offer" | "accept" | "decline"
export type RematchAction = "offer" | "decline"

/**
 * Typed Socket.IO contract shared by the server and the web client.
 * Events are namespaced as `<domain>:<action>`.
 */

export interface PongPayload {
  serverTime: number
}

export interface ServerToClientEvents {
  "system:welcome": (payload: { user: PublicUser; serverTime: number }) => void
  /** Full game state, sent to everyone in the game room after any change. */
  "game:update": (snapshot: GameSnapshot) => void
  "queue:matched": (payload: { gameId: string }) => void
}

export interface ClientToServerEvents {
  "system:ping": (ack: (payload: PongPayload) => void) => void

  "game:create": (
    payload: { timeControlId: TimeControlId; color: ColorPreference },
    ack: Ack<{ gameId: string }>,
  ) => void
  /** Opens a game: takes the empty seat of a waiting game, otherwise watches. */
  "game:join": (payload: { gameId: string }, ack: Ack<GameSnapshot>) => void
  "game:leave": (payload: { gameId: string }) => void
  /** `ply` is the number of moves the client saw before moving; stale moves are rejected. */
  "game:move": (payload: { gameId: string; uci: string; ply: number }, ack: Ack) => void
  "game:resign": (payload: { gameId: string }, ack: Ack) => void
  "game:abort": (payload: { gameId: string }, ack: Ack) => void
  "game:draw": (payload: { gameId: string; action: DrawAction }, ack: Ack) => void
  "game:rematch": (payload: { gameId: string; action: RematchAction }, ack: Ack) => void

  "queue:join": (payload: { timeControlId: TimeControlId }, ack: Ack) => void
  "queue:leave": () => void
}

export interface InterServerEvents {}

/** Set by the auth middleware when the socket connects. */
export interface SocketData {
  user: PublicUser
}
