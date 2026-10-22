import { existsSync } from "node:fs"

import { defineConfig } from "drizzle-kit"

const rootEnv = new URL("../../.env", import.meta.url)
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

// Migrations use the direct (non-pooled) connection; PgBouncer's transaction mode can break DDL.
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL_DIRECT (or DATABASE_URL) is not set. Add it to the root .env file.")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
