import type { ChatMessage } from "./chat"
import type { ColorPreference, GameSnapshot } from "./game"
import type { CallJoined, MediaState, RtcSignal } from "./rtc"
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
  /** A new chat message, sent to both players. */
  "chat:message": (message: ChatMessage) => void

  /** The opponent joined or left the call. Either way, any existing peer connection is stale. */
  "rtc:peer": (payload: { gameId: string; session: number; present: boolean }) => void
  "rtc:signal": (payload: { gameId: string; session: number; signal: RtcSignal }) => void
  "rtc:media": (payload: { gameId: string; media: MediaState }) => void
  /** The same player joined the call from another tab, which now owns it. */
  "rtc:replaced": (payload: { gameId: string }) => void
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

  /** The latest messages in a game's chat, oldest first. Players only. */
  "chat:history": (payload: { gameId: string }, ack: Ack<ChatMessage[]>) => void
  "chat:send": (payload: { gameId: string; body: string }, ack: Ack<ChatMessage>) => void

  /** Enters the game's video call (players only). The latest tab to join owns the player's seat. */
  "rtc:join": (payload: { gameId: string }, ack: Ack<CallJoined>) => void
  "rtc:leave": (payload: { gameId: string }) => void
  /** Relayed to the opponent if `session` is still current. */
  "rtc:signal": (payload: { gameId: string; session: number; signal: RtcSignal }) => void
  "rtc:media": (payload: { gameId: string; media: MediaState }) => void
}

export interface InterServerEvents {}

/** Set by the auth middleware when the socket connects. */
export interface SocketData {
  user: PublicUser
}
