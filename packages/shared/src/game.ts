import type { TimeControlId } from "./time-control"
import type { PublicUser } from "./user"

export type Color = "white" | "black"
export type ColorPreference = Color | "random"

export type GameStatus = "waiting" | "active" | "finished" | "aborted"
export type GameResult = Color | "draw"

export type Termination =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "abandonment"
  | "stalemate"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "insufficient_material"
  | "timeout_vs_insufficient_material"
  | "agreement"
  | "aborted"

export interface GamePlayer extends PublicUser {
  /** Null for guests, who play unrated. */
  rating: number | null
  /** Rating change from this game, once a rated game ends. */
  ratingDiff: number | null
}

export interface MoveRecord {
  san: string
  uci: string
  /** Mover's remaining time in ms after the move (increment included). */
  clockMs: number
}

export interface ClockState {
  whiteMs: number
  blackMs: number
  /** Side whose clock is running, or null before both players have moved and after the game. */
  running: Color | null
  /** Server time (epoch ms) when the running clock started. */
  runningSince: number | null
}

export interface GameSnapshot {
  id: string
  status: GameStatus
  rated: boolean
  timeControl: { id: TimeControlId; initialMs: number; incrementMs: number }
  white: GamePlayer | null
  black: GamePlayer | null
  fen: string
  moves: MoveRecord[]
  clock: ClockState
  /** Server time by which the side to move must play their first move, or the game is aborted. */
  firstMoveDeadline: number | null
  drawOfferBy: Color | null
  rematchOfferBy: Color | null
  rematchGameId: string | null
  result: GameResult | null
  termination: Termination | null
  /** Whether each player has the game open right now. */
  connected: { white: boolean; black: boolean }
  /** Server time at which a disconnected player forfeits by abandonment. */
  abandonDeadline: { color: Color; at: number } | null
  /** Server clock when this snapshot was built, used to correct for client clock skew. */
  serverNow: number
}

export const isGameOver = (status: GameStatus) => status === "finished" || status === "aborted"

export const otherColor = (color: Color): Color => (color === "white" ? "black" : "white")
