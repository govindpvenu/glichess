import type { Color } from "@glichess/shared"
import { z } from "zod"

import { ClientError } from "../errors"
import { gameManager } from "../game"
import { RateLimiter } from "../rate-limiter"
import type { IoServer, IoSocket } from "../realtime"
import { gameIdSchema, handle } from "../socket-handler"
import { CallRegistry } from "./calls"
import { getIceServers } from "./ice-servers"

const calls = new CallRegistry()

/** ICE gathering sends bursts of candidates; this only stops a client flooding its opponent. */
const signalLimiter = new RateLimiter({ capacity: 200, refillMs: 50 })

const schemas = {
  game: z.object({ gameId: gameIdSchema }),
  signal: z.object({
    gameId: gameIdSchema,
    session: z.number().int(),
    // Unknown keys are stripped, so only these fields are relayed.
    signal: z.union([
      z.object({
        description: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().max(20_000) }),
      }),
      z.object({
        candidate: z.object({
          candidate: z.string().max(1000),
          sdpMid: z.string().max(64).nullish(),
          sdpMLineIndex: z.number().int().min(0).max(64).nullish(),
          usernameFragment: z.string().max(256).nullish(),
        }),
      }),
    ]),
  }),
  media: z.object({
    gameId: gameIdSchema,
    media: z.object({ audio: z.boolean(), video: z.boolean() }),
  }),
}

export function registerRtcHandlers(io: IoServer, socket: IoSocket) {
  const user = () => socket.data.user
  /** Calls this socket is in, so they can be left on disconnect. */
  const joined = new Set<string>()

  const leave = (gameId: string) => {
    joined.delete(gameId)
    const left = calls.leave(gameId, socket.id)
    if (left?.peer) {
      io.to(left.peer).emit("rtc:peer", { gameId, session: left.session, present: false })
    }
  }

  socket.on(
    "rtc:join",
    handle(schemas.game, async ({ gameId }) => {
      const { white, black } = await gameManager.players(gameId)
      const color: Color | null =
        white?.id === user().id ? "white" : black?.id === user().id ? "black" : null
      if (!color || !white || !black) throw new ClientError("Only the players can join the call")

      const iceServers = await getIceServers()
      const { session, peer, replaced } = calls.join(gameId, color, socket.id)
      joined.add(gameId)
      if (replaced) io.to(replaced).emit("rtc:replaced", { gameId })
      if (peer) io.to(peer).emit("rtc:peer", { gameId, session, present: true })
      return { iceServers, session, peerPresent: peer !== null }
    }),
  )

  socket.on("rtc:leave", (payload) => {
    const parsed = schemas.game.safeParse(payload)
    if (parsed.success && joined.has(parsed.data.gameId)) leave(parsed.data.gameId)
  })

  socket.on("rtc:signal", (payload) => {
    const parsed = schemas.signal.safeParse(payload)
    if (!parsed.success || !signalLimiter.take(socket.id)) return
    const { gameId, session, signal } = parsed.data
    const peer = calls.peerOf(gameId, socket.id, session)
    if (peer) io.to(peer).emit("rtc:signal", { gameId, session, signal })
  })

  socket.on("rtc:media", (payload) => {
    const parsed = schemas.media.safeParse(payload)
    if (!parsed.success) return
    const { gameId, media } = parsed.data
    const peer = calls.peerOf(gameId, socket.id)
    if (peer) io.to(peer).emit("rtc:media", { gameId, media })
  })

  socket.on("disconnect", () => {
    for (const gameId of joined) leave(gameId)
  })
}
