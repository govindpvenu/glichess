import { existsSync } from "node:fs"
import path from "node:path"
import express from "express"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { env, isProduction } from "./env"
import { logger } from "./logger"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  app.set("trust proxy", 1)
  app.use(helmet())
  app.use(
    pinoHttp({
      logger,
      // The keep-alive pinger hits /api/health every few minutes; keep it out of the logs.
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(express.json({ limit: "100kb" }))

  // Must stay free of database and Redis calls so pings don't wake Neon or spend Upstash commands.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) })
  })

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" })
  })

  if (isProduction) serveWebApp(app)

  return app
}

/** Serves the built SPA from the same origin as the API, so auth cookies stay first-party. */
function serveWebApp(app: express.Express) {
  const dir = env.WEB_DIST_DIR
  const indexHtml = path.join(dir, "index.html")

  if (!existsSync(indexHtml)) {
    logger.warn({ dir }, "Web build not found; only the API will be served")
    return
  }

  app.use(
    "/assets",
    express.static(path.join(dir, "assets"), { immutable: true, maxAge: "1y", index: false }),
  )
  app.use(express.static(dir, { index: false }))
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache")
    res.sendFile(indexHtml)
  })
}
