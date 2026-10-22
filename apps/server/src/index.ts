import { createServer } from "node:http"

import { createApp } from "./app"
import { env } from "./env"
import { logger } from "./logger"
import { createSocketServer } from "./socket"

const httpServer = createServer(createApp())
const io = createSocketServer(httpServer)

httpServer.listen(env.PORT, () => {
  logger.info(`glichess server listening on http://localhost:${env.PORT}`)
})

let shuttingDown = false

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, "shutting down")

  // Hosts like Render send SIGTERM before replacing an instance; give clients a clean close.
  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()

  void io.close(() => {
    logger.info("server closed")
    process.exit(0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
