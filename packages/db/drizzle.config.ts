import { existsSync } from "node:fs"
import { defineConfig } from "drizzle-kit"

const rootEnv = new URL("../../.env", import.meta.url)
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to the root .env file.")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
})
