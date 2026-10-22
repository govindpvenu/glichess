import { Chess } from "chess.js"
import { describe, expect, it } from "vitest"

import { FIRST_MOVE_MS, GameEngine, hasInsufficientMaterial } from "./engine"

const T0 = 1_000_000

function newGame(initialMs = 60_000, incrementMs = 0) {
  const engine = new GameEngine({ initialMs, incrementMs })
  engine.start(T0)
  return engine
}

/** Plays SAN moves one second apart, converting them to UCI like the client does. */
function play(engine: GameEngine, sans: string[], start = T0, stepMs = 1000) {
  const scratch = new Chess(engine.fen)
  let now = start
  for (const san of sans) {
    now += stepMs
    const uci = scratch.move(san).lan
    const result = engine.move(engine.turn, uci, now)
    if (!result.ok) throw new Error(`${san}: ${result.error}`)
  }
  return now
}

describe("moves", () => {
  it("rejects moves out of turn and illegal moves", () => {
    const game = newGame()
    expect(game.move("black", "e7e5", T0)).toEqual({ ok: false, error: "It is not your turn" })
    expect(game.move("white", "e2e5", T0)).toEqual({ ok: false, error: "Illegal move" })
    expect(game.move("white", "e2e4", T0).ok).toBe(true)
    expect(game.moves[0]).toMatchObject({ san: "e4", uci: "e2e4" })
  })

  it("rejects moves before the game starts and after it ends", () => {
    const waiting = new GameEngine({ initialMs: 60_000, incrementMs: 0 })
    expect(waiting.move("white", "e2e4", T0).ok).toBe(false)

    const game = newGame()
    game.resign("white", T0)
    expect(game.move("white", "e2e4", T0).ok).toBe(false)
  })

  it("supports promotion", () => {
    const game = newGame()
    play(game, ["a4", "b5", "axb5", "a6", "bxa6", "Bb7", "axb7", "Nc6"])
    expect(game.move("white", "b7a8q", T0 + 20_000).ok).toBe(true)
    expect(game.moves.at(-1)?.san).toBe("bxa8=Q")
  })
})

describe("game end by rules", () => {
  it("detects checkmate", () => {
    const game = newGame()
    play(game, ["f3", "e5", "g4", "Qh4#"])
    expect(game).toMatchObject({ status: "finished", result: "black", termination: "checkmate" })
  })

  it("detects stalemate", () => {
    const game = newGame()
    // Sam Loyd's ten-move stalemate.
    play(game, [
      "e3",
      "a5",
      "Qh5",
      "Ra6",
      "Qxa5",
      "h5",
      "h4",
      "Rah6",
      "Qxc7",
      "f6",
      "Qxd7+",
      "Kf7",
      "Qxb7",
      "Qd3",
      "Qxb8",
      "Qh7",
      "Qxc8",
      "Kg6",
      "Qe6",
    ])
    expect(game).toMatchObject({ status: "finished", result: "draw", termination: "stalemate" })
  })

  it("detects threefold repetition", () => {
    const game = newGame()
    play(game, ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"])
    expect(game).toMatchObject({ result: "draw", termination: "threefold_repetition" })
  })
})

describe("clocks", () => {
  it("does not run clocks until both players have moved", () => {
    const game = newGame(60_000, 2_000)
    game.move("white", "e2e4", T0 + 20_000)
    game.move("black", "e7e5", T0 + 40_000)
    expect(game.whiteMs).toBe(60_000)
    expect(game.blackMs).toBe(60_000)
    expect(game.clock()).toMatchObject({ running: "white", runningSince: T0 + 40_000 })
  })

  it("charges elapsed time to the mover and adds the increment", () => {
    const game = newGame(60_000, 2_000)
    play(game, ["e4", "e5"])
    const start = game.runningSince!
    game.move("white", "g1f3", start + 5_000)
    expect(game.whiteMs).toBe(60_000 - 5_000 + 2_000)
    expect(game.moves.at(-1)?.clockMs).toBe(57_000)
    expect(game.clock().running).toBe("black")
  })

  it("aborts when a first move is not made in time", () => {
    const game = newGame()
    expect(game.checkDeadline(T0 + FIRST_MOVE_MS - 1)).toBe(false)
    expect(game.checkDeadline(T0 + FIRST_MOVE_MS)).toBe(true)
    expect(game).toMatchObject({ status: "aborted", termination: "aborted", result: null })
  })

  it("flags the side to move when their time runs out", () => {
    const game = newGame(10_000)
    play(game, ["e4", "e5"])
    const deadline = game.nextDeadline()!
    expect(deadline).toBe(game.runningSince! + 10_000)
    expect(game.checkDeadline(deadline - 1)).toBe(false)
    expect(game.checkDeadline(deadline)).toBe(true)
    expect(game).toMatchObject({ result: "black", termination: "timeout", whiteMs: 0 })
  })

  it("rejects a move made after the flag fell", () => {
    const game = newGame(10_000)
    play(game, ["e4", "e5"])
    const result = game.move("white", "g1f3", game.runningSince! + 10_001)
    expect(result.ok).toBe(false)
    expect(game.termination).toBe("timeout")
  })

  it("freezes the running clock when the game ends", () => {
    const game = newGame(60_000)
    play(game, ["e4", "e5"])
    game.resign("white", game.runningSince! + 7_000)
    expect(game.whiteMs).toBe(53_000)
    expect(game.clock().running).toBeNull()
  })
})

describe("draws, resignation and abort", () => {
  it("accepts a draw offer", () => {
    const game = newGame()
    play(game, ["e4", "e5"])
    expect(game.offerDraw("white", T0).ok).toBe(true)
    expect(game.acceptDraw("white", T0).ok).toBe(false)
    expect(game.acceptDraw("black", T0).ok).toBe(true)
    expect(game).toMatchObject({ result: "draw", termination: "agreement" })
  })

  it("treats mutual offers as agreement", () => {
    const game = newGame()
    game.offerDraw("white", T0)
    game.offerDraw("black", T0)
    expect(game.termination).toBe("agreement")
  })

  it("keeps your own offer when you move, and drops the opponent's", () => {
    const game = newGame()
    game.offerDraw("white", T0)
    play(game, ["e4"])
    expect(game.drawOfferBy).toBe("white")
    play(game, ["e5"])
    expect(game.drawOfferBy).toBeNull()
  })

  it("lets a player resign", () => {
    const game = newGame()
    game.resign("black", T0)
    expect(game).toMatchObject({ result: "white", termination: "resignation" })
  })

  it("only allows aborting before both players have moved", () => {
    const early = newGame()
    play(early, ["e4"])
    expect(early.abort().ok).toBe(true)
    expect(early.status).toBe("aborted")

    const late = newGame()
    play(late, ["e4", "e5"])
    expect(late.abort().ok).toBe(false)
  })

  it("aborts on abandonment before both moved, forfeits after", () => {
    const early = newGame()
    early.abandon("white", T0)
    expect(early.status).toBe("aborted")

    const late = newGame()
    play(late, ["e4", "e5"])
    late.abandon("white", T0 + 10_000)
    expect(late).toMatchObject({ result: "black", termination: "abandonment" })
  })
})

describe("restore", () => {
  it("rebuilds position and clocks without charging downtime", () => {
    const game = newGame(60_000, 1_000)
    play(game, ["e4", "e5", "Nf3"])
    const restored = GameEngine.restore(game.snapshot(), T0 + 999_999)
    expect(restored.fen).toBe(game.fen)
    expect(restored.turn).toBe("black")
    expect(restored.blackMs).toBe(game.blackMs)
    expect(restored.remainingMs("black", T0 + 999_999)).toBe(game.blackMs)
  })
})

describe("hasInsufficientMaterial", () => {
  it.each([
    ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "white", true],
    ["4k3/8/8/8/8/8/8/3NK3 w - - 0 1", "white", true],
    ["4k3/8/8/8/8/8/8/2NNK3 w - - 0 1", "white", false],
    ["4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "white", false],
    ["4k3/8/8/8/8/8/8/3QK3 w - - 0 1", "black", true],
  ] as const)("%s (%s) -> %s", (fen, color, expected) => {
    expect(hasInsufficientMaterial(new Chess(fen), color)).toBe(expected)
  })
})
