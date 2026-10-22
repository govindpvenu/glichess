import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { games } from "./game"

export const gameMessages = pgTable(
  "game_messages",
  {
    id: text().primaryKey(),
    gameId: text()
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    /** Author's display name when the message was sent. */
    userName: text().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.gameId, t.createdAt)],
)
