import type {
  ColorPreference,
  GameResult,
  GameSource,
  GameStatus,
  Termination,
} from "@glichess/shared"
import { sql } from "drizzle-orm"
import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

import { users } from "./auth"

export const games = pgTable(
  "games",
  {
    id: text().primaryKey(),
    // Players are nulled (not deleted) if an account is removed, so the other side's history survives.
    whiteId: text().references(() => users.id, { onDelete: "set null" }),
    blackId: text().references(() => users.id, { onDelete: "set null" }),
    /** Display names at the time of the game. */
    whiteName: text(),
    blackName: text(),
    /** Who created an invite and which side they asked for. */
    creatorId: text().references(() => users.id, { onDelete: "set null" }),
    creatorColor: text().$type<ColorPreference>(),
    source: text().$type<GameSource>().notNull(),
    rematchOfId: text(),

    timeControl: text().notNull(),
    initialMs: integer().notNull(),
    incrementMs: integer().notNull(),
    rated: boolean().notNull().default(false),

    status: text().$type<GameStatus>().notNull(),
    result: text().$type<GameResult>(),
    termination: text().$type<Termination>(),
    fen: text().notNull(),
    /** Clock state as of the last move; the running side's elapsed time is not included. */
    whiteMs: integer().notNull(),
    blackMs: integer().notNull(),

    whiteRatingBefore: integer(),
    whiteRatingAfter: integer(),
    blackRatingBefore: integer(),
    blackRatingAfter: integer(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.whiteId),
    index().on(t.blackId),
    // Only unfinished games are loaded on boot.
    index("games_live_status_index")
      .on(t.status)
      .where(sql`${t.status} in ('waiting', 'active')`),
  ],
)

export const gameMoves = pgTable(
  "game_moves",
  {
    gameId: text()
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    ply: integer().notNull(),
    san: text().notNull(),
    uci: text().notNull(),
    /** Mover's remaining time after the move, increment included. */
    clockMs: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.ply] })],
)
