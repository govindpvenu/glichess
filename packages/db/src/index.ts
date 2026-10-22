import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import * as schema from "./schema"

export function createDb(databaseUrl: string) {
  // Neon's pooled endpoint runs PgBouncer in transaction mode, which does not
  // support prepared statements.
  const client = postgres(databaseUrl, { prepare: false, max: 10 })
  const db = drizzle(client, { schema, casing: "snake_case" })
  return { db, close: () => client.end({ timeout: 5 }) }
}

/** Applies pending migrations over a short-lived direct connection. */
export async function runMigrations(databaseUrl: string, migrationsFolder: string) {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder })
  } finally {
    await client.end({ timeout: 5 })
  }
}

export type Database = ReturnType<typeof createDb>["db"]
export { schema }
