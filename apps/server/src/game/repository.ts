import { gameMoves, games, users } from "@glichess/db/schema"
import type { MoveRecord, PublicUser } from "@glichess/shared"
import { asc, eq, inArray, or, sql } from "drizzle-orm"

import { db } from "../db"
import { DEFAULT_RATING, type Rating } from "./glicko2"

export type GameRow = typeof games.$inferSelect
export type NewGameRow = typeof games.$inferInsert

export interface PlayerProfile {
  user: PublicUser
  rating: Rating
}

export async function insertGame(row: NewGameRow) {
  await db.insert(games).values(row)
}

export async function updateGame(id: string, changes: Partial<NewGameRow>) {
  await db.update(games).set(changes).where(eq(games.id, id))
}

export async function insertMove(gameId: string, ply: number, move: MoveRecord) {
  await db
    .insert(gameMoves)
    .values({ gameId, ply, san: move.san, uci: move.uci, clockMs: move.clockMs })
    .onConflictDoNothing()
}

export async function getProfiles(userIds: string[]): Promise<Map<string, PlayerProfile>> {
  if (userIds.length === 0) return new Map()
  const rows = await db.select().from(users).where(inArray(users.id, userIds))
  return new Map(rows.map((row) => [row.id, toProfile(row)]))
}

/** Records the outcome and applies rating changes atomically. */
export async function saveFinishedGame(
  id: string,
  changes: Partial<NewGameRow>,
  ratingUpdates: { userId: string; rating: Rating }[],
) {
  await db.transaction(async (tx) => {
    await tx.update(games).set(changes).where(eq(games.id, id))
    for (const { userId, rating } of ratingUpdates) {
      await tx
        .update(users)
        .set({
          rating: rating.rating,
          ratingDeviation: rating.deviation,
          ratingVolatility: rating.volatility,
          ratedGames: sqlIncrement(users.ratedGames),
        })
        .where(eq(users.id, userId))
    }
  })
}

export interface StoredGame {
  row: GameRow
  moves: MoveRecord[]
  white: PlayerProfile | null
  black: PlayerProfile | null
}

export async function loadGame(id: string): Promise<StoredGame | null> {
  const [row] = await db.select().from(games).where(eq(games.id, id))
  return row ? hydrate([row]).then((list) => list[0] ?? null) : null
}

/** Waiting and in-progress games, used to resume play after a restart. */
export async function loadLiveGames(): Promise<StoredGame[]> {
  const rows = await db
    .select()
    .from(games)
    .where(or(eq(games.status, "waiting"), eq(games.status, "active")))
  return hydrate(rows)
}

/** Re-points a guest's games to the account they just signed in with. */
export async function transferGames(fromUserId: string, toUserId: string) {
  await db.transaction(async (tx) => {
    await tx.update(games).set({ whiteId: toUserId }).where(eq(games.whiteId, fromUserId))
    await tx.update(games).set({ blackId: toUserId }).where(eq(games.blackId, fromUserId))
    await tx.update(games).set({ creatorId: toUserId }).where(eq(games.creatorId, fromUserId))
  })
}

async function hydrate(rows: GameRow[]): Promise<StoredGame[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [moveRows, profiles] = await Promise.all([
    db.select().from(gameMoves).where(inArray(gameMoves.gameId, ids)).orderBy(asc(gameMoves.ply)),
    getProfiles(rows.flatMap((r) => [r.whiteId, r.blackId]).filter((id) => id !== null)),
  ])

  return rows.map((row) => ({
    row,
    moves: moveRows
      .filter((m) => m.gameId === row.id)
      .map((m) => ({ san: m.san, uci: m.uci, clockMs: m.clockMs })),
    white: seatProfile(row, "white", profiles),
    black: seatProfile(row, "black", profiles),
  }))
}

/**
 * A seat's player. Once a player's account is gone (e.g. a removed guest) the seat keeps their
 * name from the time of the game, so finished games still show who played.
 */
function seatProfile(
  row: GameRow,
  color: "white" | "black",
  profiles: Map<string, PlayerProfile>,
): PlayerProfile | null {
  const id = color === "white" ? row.whiteId : row.blackId
  const name = color === "white" ? row.whiteName : row.blackName
  if (id) return profiles.get(id) ?? null
  if (!name || row.status === "waiting") return null
  return {
    user: { id: `removed:${row.id}:${color}`, name, image: null, isGuest: true },
    rating: DEFAULT_RATING,
  }
}

function toProfile(row: typeof users.$inferSelect): PlayerProfile {
  return {
    user: { id: row.id, name: row.name, image: row.image, isGuest: row.isAnonymous },
    rating: {
      rating: row.rating,
      deviation: row.ratingDeviation,
      volatility: row.ratingVolatility,
    },
  }
}

function sqlIncrement(column: typeof users.ratedGames) {
  return sql`${column} + 1`
}
