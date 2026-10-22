import { describe, expect, it } from "vitest"

import { Matchmaking } from "./matchmaking"

const user = (id: string) => ({ id, name: id, image: null, isGuest: true })

describe("Matchmaking", () => {
  it("pairs two players on the same time control", () => {
    const queue = new Matchmaking()
    expect(queue.join(user("a"), "3+2")).toBeNull()
    expect(queue.join(user("b"), "5+0")).toBeNull()
    expect(queue.join(user("c"), "3+2")?.id).toBe("a")
    expect(queue.join(user("d"), "3+2")).toBeNull()
  })

  it("never pairs a player with themselves", () => {
    const queue = new Matchmaking()
    queue.join(user("a"), "3+2")
    expect(queue.join(user("a"), "3+2")).toBeNull()
  })

  it("keeps a player in only one queue and removes them on leave", () => {
    const queue = new Matchmaking()
    queue.join(user("a"), "3+2")
    queue.join(user("a"), "5+0")
    expect(queue.join(user("b"), "3+2")).toBeNull()
    queue.leave("a")
    expect(queue.join(user("c"), "5+0")).toBeNull()
  })
})
