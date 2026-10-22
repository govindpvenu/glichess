import { describe, expect, it } from "vitest"

import { RateLimiter } from "./rate-limiter"

describe("RateLimiter", () => {
  it("allows a burst up to capacity, then refuses", () => {
    const limiter = new RateLimiter({ capacity: 3, refillMs: 1000 })
    expect([1, 2, 3, 4].map(() => limiter.take("a", 0))).toEqual([true, true, true, false])
  })

  it("refills one token per interval", () => {
    const limiter = new RateLimiter({ capacity: 2, refillMs: 1000 })
    limiter.take("a", 0)
    limiter.take("a", 0)
    expect(limiter.take("a", 500)).toBe(false)
    expect(limiter.take("a", 1000)).toBe(true)
    expect(limiter.take("a", 1000)).toBe(false)
  })

  it("never refills past capacity", () => {
    const limiter = new RateLimiter({ capacity: 2, refillMs: 1000 })
    limiter.take("a", 0)
    const later = 60_000
    expect([1, 2, 3].map(() => limiter.take("a", later))).toEqual([true, true, false])
  })

  it("tracks keys separately", () => {
    const limiter = new RateLimiter({ capacity: 1, refillMs: 1000 })
    expect(limiter.take("a", 0)).toBe(true)
    expect(limiter.take("b", 0)).toBe(true)
    expect(limiter.take("a", 0)).toBe(false)
  })
})
