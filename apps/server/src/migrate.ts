import { runMigrations } from "@glichess/db"

import { env, isProduction } from "./env"
import { logger } from "./logger"

export async function migrateIfEnabled() {
  if (!(env.RUN_MIGRATIONS ?? isProduction)) return

  const startedAt = performance.now()
  await runMigrations(env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, env.MIGRATIONS_DIR)
  logger.info({ ms: Math.round(performance.now() - startedAt) }, "database migrations applied")
}
