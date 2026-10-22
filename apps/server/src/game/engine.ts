import {
  otherColor,
  type ClockState,
  type Color,
  type GameResult,
  type GameStatus,
  type MoveRecord,
  type Termination,
} from "@glichess/shared"
import { Chess, type Move } from "chess.js"

/** Each side gets this long to play their first move; otherwise the game is aborted. Clocks start after both have moved. */
export const FIRST_MOVE_MS = 30_000

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })
const OK: ActionResult = { ok: true }

export interface EngineSnapshot {
  status: GameStatus
  initialMs: number
  incrementMs: number
  moves: MoveRecord[]
  whiteMs: number
  blackMs: number
  result: GameResult | null
  termination: Termination | null
}

/**
 * Authoritative rules and clocks for one game. Pure and synchronous: callers pass the current
 * time, so every path is deterministic and unit-testable. Persistence and sockets live elsewhere.
 */
export class GameEngine {
  readonly initialMs: number
  readonly incrementMs: number
  status: GameStatus = "waiting"
  moves: MoveRecord[] = []
  whiteMs: number
  blackMs: number
  /** When the running clock started (server epoch ms). */
  runningSince: number | null = null
  firstMoveDeadline: number | null = null
  drawOfferBy: Color | null = null
  result: GameResult | null = null
  termination: Termination | null = null

  private readonly chess = new Chess()

  constructor({ initialMs, incrementMs }: { initialMs: number; incrementMs: number }) {
    this.initialMs = initialMs
    this.incrementMs = incrementMs
    this.whiteMs = initialMs
    this.blackMs = initialMs
  }

  /** Rebuilds a game from storage. Running clocks restart at `now`, so downtime is not charged to anyone. */
  static restore(saved: EngineSnapshot, now: number): GameEngine {
    const engine = new GameEngine(saved)
    for (const move of saved.moves) engine.chess.move(move.uci)
    engine.moves = [...saved.moves]
    engine.whiteMs = saved.whiteMs
    engine.blackMs = saved.blackMs
    engine.status = saved.status
    engine.result = saved.result
    engine.termination = saved.termination
    if (engine.status === "active") {
      if (engine.ply < 2) engine.firstMoveDeadline = now + FIRST_MOVE_MS
      else engine.runningSince = now
    }
    return engine
  }

  get ply() {
    return this.moves.length
  }

  get turn(): Color {
    return this.chess.turn() === "w" ? "white" : "black"
  }

  get fen() {
    return this.chess.fen()
  }

  /** The side whose clock is ticking. Clocks run only once both players have made a move. */
  get runningColor(): Color | null {
    return this.status === "active" && this.ply >= 2 ? this.turn : null
  }

  start(now: number) {
    if (this.status !== "waiting") return
    this.status = "active"
    this.firstMoveDeadline = now + FIRST_MOVE_MS
  }

  remainingMs(color: Color, now: number) {
    const stored = color === "white" ? this.whiteMs : this.blackMs
    if (this.runningColor !== color || this.runningSince === null) return stored
    return Math.max(0, stored - (now - this.runningSince))
  }

  clock(): ClockState {
    return {
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      running: this.runningColor,
      runningSince: this.runningColor ? this.runningSince : null,
    }
  }

  /** When the game next needs attention if nobody acts: a first-move deadline or a flag fall. */
  nextDeadline(): number | null {
    if (this.status !== "active") return null
    if (this.ply < 2) return this.firstMoveDeadline
    if (this.runningSince === null) return null
    return this.runningSince + (this.turn === "white" ? this.whiteMs : this.blackMs)
  }

  /** Ends the game if the side to move has run out of time. Returns true if the game ended. */
  checkDeadline(now: number): boolean {
    if (this.status !== "active") return false
    if (this.ply < 2) {
      if (this.firstMoveDeadline !== null && now >= this.firstMoveDeadline) {
        this.endAborted()
        return true
      }
      return false
    }
    if (this.remainingMs(this.turn, now) > 0) return false
    this.flag(this.turn, now)
    return true
  }

  move(color: Color, uci: string, now: number): ActionResult {
    if (this.status !== "active") return fail("The game is not in progress")
    if (color !== this.turn) return fail("It is not your turn")
    if (this.checkDeadline(now)) return fail("Time is up")

    // Read the clock before the move flips whose turn it is.
    const remainingBefore = this.remainingMs(color, now)
    let played: Move
    try {
      played = this.chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      })
    } catch {
      return fail("Illegal move")
    }

    const plyBefore = this.ply
    let clockMs = color === "white" ? this.whiteMs : this.blackMs
    if (plyBefore >= 2) {
      clockMs = remainingBefore + this.incrementMs
      this.runningSince = now
    } else if (plyBefore === 1) {
      // Black's first move starts White's clock.
      this.firstMoveDeadline = null
      this.runningSince = now
    } else {
      this.firstMoveDeadline = now + FIRST_MOVE_MS
    }
    if (color === "white") this.whiteMs = clockMs
    else this.blackMs = clockMs

    this.moves.push({ san: played.san, uci: played.lan, clockMs })
    // Moving instead of answering declines the opponent's draw offer; your own offer stands.
    if (this.drawOfferBy === otherColor(color)) this.drawOfferBy = null

    this.endIfDecidedByRules(color, now)
    return OK
  }

  resign(color: Color, now: number): ActionResult {
    if (this.status !== "active") return fail("The game is not in progress")
    this.finish(otherColor(color), "resignation", now)
    return OK
  }

  abort(): ActionResult {
    if (this.status === "waiting") {
      this.endAborted()
      return OK
    }
    if (this.status !== "active") return fail("The game is not in progress")
    if (this.ply >= 2) return fail("Games can only be aborted before both players have moved")
    this.endAborted()
    return OK
  }

  offerDraw(color: Color, now: number): ActionResult {
    if (this.status !== "active") return fail("The game is not in progress")
    if (this.drawOfferBy === otherColor(color)) return this.acceptDraw(color, now)
    this.drawOfferBy = color
    return OK
  }

  acceptDraw(color: Color, now: number): ActionResult {
    if (this.status !== "active") return fail("The game is not in progress")
    if (this.drawOfferBy !== otherColor(color)) return fail("There is no draw offer to accept")
    this.finish("draw", "agreement", now)
    return OK
  }

  declineDraw(color: Color): ActionResult {
    if (this.drawOfferBy !== otherColor(color)) return fail("There is no draw offer to decline")
    this.drawOfferBy = null
    return OK
  }

  /** A player left and did not come back in time. */
  abandon(color: Color, now: number): ActionResult {
    if (this.status !== "active") return fail("The game is not in progress")
    if (this.ply < 2) this.endAborted()
    else this.finish(otherColor(color), "abandonment", now)
    return OK
  }

  snapshot(): EngineSnapshot {
    return {
      status: this.status,
      initialMs: this.initialMs,
      incrementMs: this.incrementMs,
      moves: [...this.moves],
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      result: this.result,
      termination: this.termination,
    }
  }

  private flag(loser: Color, now: number) {
    const winner = otherColor(loser)
    if (loser === "white") this.whiteMs = 0
    else this.blackMs = 0
    // A side that cannot possibly checkmate does not win on time.
    if (hasInsufficientMaterial(this.chess, winner)) {
      this.finish("draw", "timeout_vs_insufficient_material", now)
    } else {
      this.finish(winner, "timeout", now)
    }
  }

  private endIfDecidedByRules(mover: Color, now: number) {
    const chess = this.chess
    if (chess.isCheckmate()) this.finish(mover, "checkmate", now)
    else if (chess.isStalemate()) this.finish("draw", "stalemate", now)
    else if (chess.isInsufficientMaterial()) this.finish("draw", "insufficient_material", now)
    else if (chess.isThreefoldRepetition()) this.finish("draw", "threefold_repetition", now)
    else if (chess.isDrawByFiftyMoves()) this.finish("draw", "fifty_move_rule", now)
  }

  private finish(result: GameResult, termination: Termination, now: number) {
    const running = this.runningColor
    if (running && this.runningSince !== null) {
      const left = this.remainingMs(running, now)
      if (running === "white") this.whiteMs = left
      else this.blackMs = left
    }
    this.status = "finished"
    this.result = result
    this.termination = termination
    this.runningSince = null
    this.firstMoveDeadline = null
    this.drawOfferBy = null
  }

  private endAborted() {
    this.status = "aborted"
    this.result = null
    this.termination = "aborted"
    this.runningSince = null
    this.firstMoveDeadline = null
    this.drawOfferBy = null
  }
}

/** True when `color` has only a king, or a king and a single minor piece: no mate is possible. */
export function hasInsufficientMaterial(chess: Chess, color: Color) {
  const side = color === "white" ? "w" : "b"
  const pieces = chess
    .board()
    .flat()
    .filter((sq) => sq !== null && sq.color === side && sq.type !== "k")
  if (pieces.length === 0) return true
  return pieces.length === 1 && (pieces[0]?.type === "b" || pieces[0]?.type === "n")
}
