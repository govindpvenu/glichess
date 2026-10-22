import { createServer } from "node:http"

import { createApp } from "./app"
import { closeDb } from "./db"
import { env } from "./env"
import { gameManager, gameRoom } from "./game"
import { logger } from "./logger"
import { migrateIfEnabled } from "./migrate"
import { createSocketServer } from "./socket"

try {
  await migrateIfEnabled()
} catch (error) {
  logger.fatal({ err: error }, "database migration failed")
  process.exit(1)
}

const httpServer = createServer(createApp())
const io = createSocketServer(httpServer)

gameManager.attach((gameId, snapshot) => io.to(gameRoom(gameId)).emit("game:update", snapshot))
try {
  await gameManager.restore()
} catch (error) {
  logger.error({ err: error }, "failed to restore live games")
}

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

  void (async () => {
    gameManager.stop()
    // Stop taking moves, then let queued game writes reach the database before closing it.
    await new Promise<void>((resolve) => void io.close(() => resolve()))
    await gameManager.flush()
    await closeDb()
    logger.info("server closed")
    process.exit(0)
  })()
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
