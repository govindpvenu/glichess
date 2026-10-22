import { z } from "zod"

import { userRoom, type IoServer, type IoSocket } from "../realtime"
import { gameIdSchema, handle } from "../socket-handler"
import { chatHistory, sendMessage } from "./service"

const schemas = {
  history: z.object({ gameId: gameIdSchema }),
  // Checked again after whitespace is collapsed; this only bounds what is parsed.
  send: z.object({ gameId: gameIdSchema, body: z.string().max(2000) }),
}

export function registerChatHandlers(io: IoServer, socket: IoSocket) {
  const user = () => socket.data.user

  socket.on(
    "chat:history",
    handle(schemas.history, ({ gameId }) => chatHistory(gameId, user())),
  )

  socket.on(
    "chat:send",
    handle(schemas.send, async ({ gameId, body }) => {
      const { message, recipients } = await sendMessage(gameId, user(), body)
      // Delivered to the players' own rooms, so spectators in the game room never see it.
      io.to(recipients.map(userRoom)).emit("chat:message", message)
      return message
    }),
  )
}
