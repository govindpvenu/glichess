import { describe, expect, it } from "vitest"

import { DEFAULT_RATING, updateRating } from "./glicko2"

describe("updateRating", () => {
  it("matches the worked example in Glickman's paper", () => {
    const result = updateRating({ rating: 1500, deviation: 200, volatility: 0.06 }, [
      { rating: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
      { rating: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
      { rating: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 },
    ])
    expect(result.rating).toBeCloseTo(1464.06, 1)
    expect(result.deviation).toBeCloseTo(151.52, 1)
    expect(result.volatility).toBeCloseTo(0.05999, 4)
  })

  it("moves new players symmetrically after a decisive game", () => {
    const winner = updateRating(DEFAULT_RATING, [{ rating: DEFAULT_RATING, score: 1 }])
    const loser = updateRating(DEFAULT_RATING, [{ rating: DEFAULT_RATING, score: 0 }])
    expect(winner.rating - 1500).toBeCloseTo(1500 - loser.rating, 6)
    expect(winner.rating).toBeGreaterThan(1600)
    expect(winner.deviation).toBeLessThan(350)
  })

  it("leaves equal players unchanged after a draw", () => {
    const result = updateRating(DEFAULT_RATING, [{ rating: DEFAULT_RATING, score: 0.5 }])
    expect(result.rating).toBeCloseTo(1500, 6)
  })
})
