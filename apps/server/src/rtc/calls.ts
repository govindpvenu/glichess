import { otherColor, type Color } from "@glichess/shared"

interface Call {
  session: number
  /** Socket id holding each player's seat in the call. */
  members: Partial<Record<Color, string>>
}

/**
 * Who is in each game's call. Every change of membership starts a new session, which tells both
 * sides to discard their peer connection and any signals still in flight for the old one.
 */
export class CallRegistry {
  private readonly calls = new Map<string, Call>()
  /** Global, so a session number is never reused even after a call is dropped and recreated. */
  private nextSession = 1

  join(gameId: string, color: Color, socketId: string) {
    const call = this.calls.get(gameId) ?? { session: 0, members: {} }
    const previous = call.members[color]
    call.members[color] = socketId
    call.session = this.nextSession++
    this.calls.set(gameId, call)
    return {
      session: call.session,
      peer: call.members[otherColor(color)] ?? null,
      /** Another tab of the same player that just lost its seat. */
      replaced: previous && previous !== socketId ? previous : null,
    }
  }

  /** Returns the remaining member to notify, or null if the socket wasn't in the call. */
  leave(gameId: string, socketId: string) {
    const call = this.calls.get(gameId)
    const color = call && colorOf(call, socketId)
    if (!call || !color) return null
    delete call.members[color]
    call.session = this.nextSession++
    const peer = call.members[otherColor(color)] ?? null
    if (!peer) this.calls.delete(gameId)
    return { session: call.session, peer }
  }

  /** The opponent's socket, if `socketId` is in the call and `session` (when given) is current. */
  peerOf(gameId: string, socketId: string, session?: number) {
    const call = this.calls.get(gameId)
    const color = call && colorOf(call, socketId)
    if (!call || !color || (session !== undefined && session !== call.session)) return null
    return call.members[otherColor(color)] ?? null
  }
}

function colorOf(call: Call, socketId: string): Color | null {
  if (call.members.white === socketId) return "white"
  if (call.members.black === socketId) return "black"
  return null
}
