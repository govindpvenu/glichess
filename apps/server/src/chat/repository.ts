import { gameMessages } from "@glichess/db/schema"
import type { ChatMessage } from "@glichess/shared"
import { desc, eq } from "drizzle-orm"

import { db } from "../db"

export async function insertMessage(message: ChatMessage) {
  await db.insert(gameMessages).values({
    id: message.id,
    gameId: message.gameId,
    userId: message.userId,
    userName: message.name,
    body: message.body,
    createdAt: new Date(message.createdAt),
  })
}

/** The newest `limit` messages of a game, oldest first. */
export async function listMessages(gameId: string, limit: number): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(gameMessages)
    .where(eq(gameMessages.gameId, gameId))
    .orderBy(desc(gameMessages.createdAt), desc(gameMessages.id))
    .limit(limit)
  return rows.toReversed().map((row) => ({
    id: row.id,
    gameId: row.gameId,
    userId: row.userId,
    name: row.userName,
    body: row.body,
    createdAt: row.createdAt.getTime(),
  }))
}

/** Re-points a guest's messages to the account they just signed in with. */
export async function transferMessages(fromUserId: string, toUserId: string) {
  await db.update(gameMessages).set({ userId: toUserId }).where(eq(gameMessages.userId, fromUserId))
}
