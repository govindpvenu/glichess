import type { Server as HttpServer } from "node:http"

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@glichess/shared"
import { Server } from "socket.io"

import { logger } from "./logger"

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export function createSocketServer(httpServer: HttpServer): IoServer {
  // The web app is served from the same origin, so no CORS configuration is needed.
  const io: IoServer = new Server(httpServer, {
    serveClient: false,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  })

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id, recovered: socket.recovered }, "socket connected")

    socket.emit("system:welcome", { socketId: socket.id, serverTime: Date.now() })

    socket.on("system:ping", (ack) => {
      if (typeof ack === "function") ack({ serverTime: Date.now() })
    })

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "socket disconnected")
    })
  })

  return io
}
