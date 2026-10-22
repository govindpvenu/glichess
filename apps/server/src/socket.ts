import type { Server as HttpServer } from "node:http"

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@glichess/shared"
import { fromNodeHeaders } from "better-auth/node"
import { Server } from "socket.io"

import { auth, toPublicUser } from "./auth"
import { logger } from "./logger"

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

/** Room holding every socket (tab) a user has open. */
export const userRoom = (userId: string) => `user:${userId}`

export function createSocketServer(httpServer: HttpServer): IoServer {
  // The web app is served from the same origin, so no CORS configuration is needed.
  const io: IoServer = new Server(httpServer, {
    serveClient: false,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  })

  // Identify the player from the session cookie sent with the handshake.
  io.use((socket, next) => {
    auth.api
      .getSession({ headers: fromNodeHeaders(socket.handshake.headers) })
      .then((session) => {
        if (!session) return next(new Error("UNAUTHORIZED"))
        socket.data.user = toPublicUser(session.user)
        next()
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "socket auth failed")
        next(new Error("AUTH_FAILED"))
      })
  })

  io.on("connection", (socket) => {
    const { user } = socket.data
    logger.debug(
      { socketId: socket.id, userId: user.id, recovered: socket.recovered },
      "socket connected",
    )

    void socket.join(userRoom(user.id))
    socket.emit("system:welcome", { user, serverTime: Date.now() })

    socket.on("system:ping", (ack) => {
      if (typeof ack === "function") ack({ serverTime: Date.now() })
    })

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, userId: user.id, reason }, "socket disconnected")
    })
  })

  return io
}
