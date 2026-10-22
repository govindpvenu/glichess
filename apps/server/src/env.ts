import path from "node:path"

import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Directory holding the built web app. Served in production only. */
  WEB_DIST_DIR: z.string().default(path.resolve(import.meta.dirname, "../../web/dist")),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === "production"
