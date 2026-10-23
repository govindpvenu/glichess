import { games, sessions, users, verifications } from "@glichess/db/schema"
import { and, eq, gt, inArray, isNull, lt, notExists, or } from "drizzle-orm"

import { db } from "../db"
import { logger } from "../logger"

const HOUR = 60 * 60 * 1000
/** Guests this new are kept even without a session, so sign-up can never race the cleanup. */
const GUEST_GRACE_MS = 24 * HOUR
const INTERVAL_MS = 6 * HOUR
const FIRST_RUN_DELAY_MS = 60 * 1000
/** Rows deleted per statement, keeping each transaction short. */
const BATCH = 500

/**
 * Removes data nobody can reach any more:
 * - guests whose sessions have all expired. A guest has no password or provider, so once the
 *   session is gone the account can never be signed into again. Their games keep the stored
 *   names (see seatProfile); games they were alone in go next.
 * - finished and aborted games with no remaining player.
 * - expired sessions and verification tokens.
 */
export async function cleanup(now = new Date()) {
  const guests = await deleteInBatches(() => {
    const removable = db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isAnonymous, true),
          lt(users.createdAt, new Date(now.getTime() - GUEST_GRACE_MS)),
          notExists(
            db
              .select({ id: sessions.id })
              .from(sessions)
              .where(and(eq(sessions.userId, users.id), gt(sessions.expiresAt, now))),
          ),
          // Belt and braces: never touch someone seated in, or waiting on, a live game.
          notExists(
            db
              .select({ id: games.id })
              .from(games)
              .where(
                and(
                  inArray(games.status, ["waiting", "active"]),
                  or(
                    eq(games.whiteId, users.id),
                    eq(games.blackId, users.id),
                    eq(games.creatorId, users.id),
                  ),
                ),
              ),
          ),
        ),
      )
      .limit(BATCH)
    return db.delete(users).where(inArray(users.id, removable)).returning({ id: users.id })
  })

  const orphanGames = await deleteInBatches(() => {
    const removable = db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          inArray(games.status, ["finished", "aborted"]),
          isNull(games.whiteId),
          isNull(games.blackId),
        ),
      )
      .limit(BATCH)
    return db.delete(games).where(inArray(games.id, removable)).returning({ id: games.id })
  })

  const [expiredSessions, expiredVerifications] = await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id }),
    db
      .delete(verifications)
      .where(lt(verifications.expiresAt, now))
      .returning({ id: verifications.id }),
  ])

  return {
    guests,
    orphanGames,
    sessions: expiredSessions.length,
    verifications: expiredVerifications.length,
  }
}

async function deleteInBatches(deleteBatch: () => Promise<unknown[]>) {
  let total = 0
  for (;;) {
    const deleted = (await deleteBatch()).length
    total += deleted
    if (deleted < BATCH) return total
  }
}

function run() {
  cleanup().then(
    (counts) => logger.info(counts, "cleanup finished"),
    (error: unknown) => logger.error({ err: error }, "cleanup failed"),
  )
}

/** Runs the cleanup shortly after boot, then every few hours. Returns a function that stops it. */
export function scheduleCleanup() {
  let interval: NodeJS.Timeout | undefined
  const first = setTimeout(() => {
    run()
    interval = setInterval(run, INTERVAL_MS)
    interval.unref()
  }, FIRST_RUN_DELAY_MS)
  first.unref()
  return () => {
    clearTimeout(first)
    clearInterval(interval)
  }
}
