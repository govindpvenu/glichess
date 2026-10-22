import { isTimeControlId } from "@glichess/shared"
import { z } from "zod"

import { userRoom, type IoServer, type IoSocket } from "../realtime"
import { gameIdSchema, handle } from "../socket-handler"
import { gameManager, gameRoom, matchmaking } from "./index"

const timeControlIdSchema = z.string().refine(isTimeControlId, "Unknown time control")

const schemas = {
  create: z.object({
    timeControlId: timeControlIdSchema,
    color: z.enum(["white", "black", "random"]),
  }),
  join: z.object({ gameId: gameIdSchema }),
  move: z.object({
    gameId: gameIdSchema,
    uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
    ply: z.number().int().min(0),
  }),
  draw: z.object({ gameId: gameIdSchema, action: z.enum(["offer", "accept", "decline"]) }),
  rematch: z.object({ gameId: gameIdSchema, action: z.enum(["offer", "decline"]) }),
  queue: z.object({ timeControlId: timeControlIdSchema }),
}

export function registerGameHandlers(io: IoServer, socket: IoSocket) {
  const user = () => socket.data.user
  /** Games this socket has open, so presence can be released on disconnect. */
  const openGames = new Set<string>()

  socket.on(
    "game:create",
    handle(schemas.create, async ({ timeControlId, color }) => ({
      gameId: gameManager.createInvite(user(), timeControlId, color),
    })),
  )

  socket.on(
    "game:join",
    handle(schemas.join, async ({ gameId }) => {
      // A reconnecting client re-joins on the same socket; presence must not be counted twice.
      const snapshot = await gameManager.join(gameId, user(), {
        countPresence: !openGames.has(gameId),
      })
      openGames.add(gameId)
      await socket.join(gameRoom(gameId))
      return snapshot
    }),
  )

  socket.on("game:leave", (payload) => {
    const parsed = schemas.join.safeParse(payload)
    if (!parsed.success || !openGames.delete(parsed.data.gameId)) return
    void socket.leave(gameRoom(parsed.data.gameId))
    gameManager.leave(parsed.data.gameId, user().id)
  })

  socket.on(
    "game:move",
    handle(schemas.move, async ({ gameId, uci, ply }) => {
      gameManager.move(gameId, user(), uci, ply)
      return undefined
    }),
  )
  socket.on(
    "game:resign",
    handle(schemas.join, async ({ gameId }) => {
      gameManager.resign(gameId, user())
      return undefined
    }),
  )
  socket.on(
    "game:abort",
    handle(schemas.join, async ({ gameId }) => {
      gameManager.abort(gameId, user())
      return undefined
    }),
  )
  socket.on(
    "game:draw",
    handle(schemas.draw, async ({ gameId, action }) => {
      gameManager.draw(gameId, user(), action)
      return undefined
    }),
  )
  socket.on(
    "game:rematch",
    handle(schemas.rematch, async ({ gameId, action }) => {
      await gameManager.rematch(gameId, user(), action)
      return undefined
    }),
  )

  socket.on(
    "queue:join",
    handle(schemas.queue, async ({ timeControlId }) => {
      const opponent = matchmaking.join(user(), timeControlId)
      if (!opponent) return undefined
      // The player who waited longest gets a random colour like everyone else.
      const [white, black] = Math.random() < 0.5 ? [user(), opponent] : [opponent, user()]
      const gameId = await gameManager.createMatch({ white, black }, timeControlId, {
        source: "quick",
      })
      io.to([userRoom(white.id), userRoom(black.id)]).emit("queue:matched", { gameId })
      return undefined
    }),
  )
  socket.on("queue:leave", () => matchmaking.leave(user().id))

  socket.on("disconnect", () => {
    for (const id of openGames) gameManager.leave(id, user().id)
    openGames.clear()
    // Only drop the queue entry once the user has no other tab open.
    if (!io.sockets.adapter.rooms.get(userRoom(user().id))?.size) matchmaking.leave(user().id)
  })
}
