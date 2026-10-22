import { describe, expect, it } from "vitest"

import { normalizeMessage } from "./normalize"

describe("normalizeMessage", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeMessage("  good \t\n  game  ")).toBe("good game")
  })

  it("replaces control characters", () => {
    expect(normalizeMessage("gg\u0000\u0007wp")).toBe("gg wp")
  })

  it("keeps emoji sequences intact", () => {
    expect(normalizeMessage("nice 👍🏽 👨‍👩‍👧")).toBe("nice 👍🏽 👨‍👩‍👧")
  })

  it("returns an empty string for blank input", () => {
    expect(normalizeMessage(" \n\t ")).toBe("")
  })
})
