import path from "node:path"

import { z } from "zod"

const booleanString = z.enum(["true", "false"]).transform((v) => v === "true")

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Directory holding the built web app. Served in production only. */
  WEB_DIST_DIR: z.string().default(path.resolve(import.meta.dirname, "../../web/dist")),

  /** Pooled Neon connection string, used by the app at runtime. */
  DATABASE_URL: z.url(),
  /** Direct (non-pooled) connection string, used for migrations. Falls back to DATABASE_URL. */
  DATABASE_URL_DIRECT: z.url().optional(),
  MIGRATIONS_DIR: z
    .string()
    .default(path.resolve(import.meta.dirname, "../../../packages/db/drizzle")),
  /** Apply pending migrations on boot. Defaults to on in production, since Render's free tier has no pre-deploy step. */
  RUN_MIGRATIONS: booleanString.optional(),

  /** Public origin of the app, e.g. http://localhost:5173 in dev. Auth cookies and OAuth callbacks use it. */
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "Generate one with: openssl rand -base64 32"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  /** Cloudflare Realtime TURN key. Without it calls use STUN only, which fails behind strict NATs. */
  CLOUDFLARE_TURN_KEY_ID: z.string().min(1).optional(),
  CLOUDFLARE_TURN_API_TOKEN: z.string().min(1).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === "production"

// A dev URL here makes Better Auth reject every sign-in and send OAuth callbacks to localhost.
if (isProduction && !env.BETTER_AUTH_URL.startsWith("https://")) {
  console.error(
    `BETTER_AUTH_URL must be the public https:// origin in production (got "${env.BETTER_AUTH_URL}").`,
  )
  process.exit(1)
}
