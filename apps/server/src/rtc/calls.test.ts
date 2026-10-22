import { describe, expect, it } from "vitest"

import { CallRegistry } from "./calls"

describe("CallRegistry", () => {
  it("pairs the two players and starts a new session for each change", () => {
    const calls = new CallRegistry()
    const first = calls.join("g", "white", "w1")
    expect(first.peer).toBeNull()
    const second = calls.join("g", "black", "b1")
    expect(second.peer).toBe("w1")
    expect(second.session).toBeGreaterThan(first.session)
  })

  it("relays only within the current session", () => {
    const calls = new CallRegistry()
    calls.join("g", "white", "w1")
    const { session } = calls.join("g", "black", "b1")
    expect(calls.peerOf("g", "w1", session)).toBe("b1")
    expect(calls.peerOf("g", "b1", session)).toBe("w1")
    expect(calls.peerOf("g", "w1", session - 1)).toBeNull()
    expect(calls.peerOf("g", "stranger", session)).toBeNull()
  })

  it("hands the seat to a player's newest tab", () => {
    const calls = new CallRegistry()
    calls.join("g", "white", "w1")
    calls.join("g", "black", "b1")
    const moved = calls.join("g", "white", "w2")
    expect(moved.replaced).toBe("w1")
    expect(moved.peer).toBe("b1")
    expect(calls.peerOf("g", "w1")).toBeNull()
    // The old tab leaving later must not affect the call.
    expect(calls.leave("g", "w1")).toBeNull()
    expect(calls.peerOf("g", "b1")).toBe("w2")
  })

  it("rejoining from the same tab is not a replacement", () => {
    const calls = new CallRegistry()
    calls.join("g", "white", "w1")
    expect(calls.join("g", "white", "w1").replaced).toBeNull()
  })

  it("tells the remaining player when the other leaves", () => {
    const calls = new CallRegistry()
    calls.join("g", "white", "w1")
    const { session } = calls.join("g", "black", "b1")
    const left = calls.leave("g", "b1")
    expect(left?.peer).toBe("w1")
    expect(left!.session).toBeGreaterThan(session)
    expect(calls.leave("g", "w1")).toEqual({ session: expect.any(Number), peer: null })
  })

  it("never reuses a session number after a call is dropped", () => {
    const calls = new CallRegistry()
    const { session } = calls.join("g", "white", "w1")
    calls.leave("g", "w1")
    expect(calls.join("g", "white", "w1").session).toBeGreaterThan(session)
  })
})
