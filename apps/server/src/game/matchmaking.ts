import type { PublicUser, TimeControlId } from "@glichess/shared"

/**
 * One waiting player per time control. A second player for the same control is paired
 * immediately. In memory, which is fine for a single server instance.
 */
export class Matchmaking {
  private readonly waiting = new Map<TimeControlId, PublicUser>()

  /** Returns the opponent if this join completes a pair; otherwise queues the user. */
  join(user: PublicUser, timeControlId: TimeControlId): PublicUser | null {
    this.leave(user.id)
    const opponent = this.waiting.get(timeControlId)
    if (opponent && opponent.id !== user.id) {
      this.waiting.delete(timeControlId)
      return opponent
    }
    this.waiting.set(timeControlId, user)
    return null
  }

  leave(userId: string) {
    for (const [timeControlId, user] of this.waiting) {
      if (user.id === userId) this.waiting.delete(timeControlId)
    }
  }
}
