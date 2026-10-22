import { randomUUID } from "node:crypto"

import { CHAT_MAX_LENGTH, type ChatMessage, type PublicUser } from "@glichess/shared"

import { ClientError } from "../errors"
import { gameManager } from "../game"
import { RateLimiter } from "../rate-limiter"
import { normalizeMessage } from "./normalize"
import * as repo from "./repository"

const HISTORY_LIMIT = 200

/** Five messages in a burst, then one every two seconds. */
const limiter = new RateLimiter({ capacity: 5, refillMs: 2000 })

/** Throws unless the user plays in the game; returns both players' ids. */
async function requirePlayer(gameId: string, user: PublicUser) {
  const { white, black } = await gameManager.players(gameId)
  if (!white || !black || (user.id !== white.id && user.id !== black.id)) {
    throw new ClientError("Only the players can use this chat")
  }
  return [white.id, black.id]
}

export async function chatHistory(gameId: string, user: PublicUser) {
  await requirePlayer(gameId, user)
  return repo.listMessages(gameId, HISTORY_LIMIT)
}

/** Saves a message and returns it with the user ids it should be delivered to. */
export async function sendMessage(gameId: string, user: PublicUser, rawBody: string) {
  const body = normalizeMessage(rawBody)
  if (!body) throw new ClientError("Message is empty")
  if (body.length > CHAT_MAX_LENGTH) {
    throw new ClientError(`Messages can be at most ${CHAT_MAX_LENGTH} characters`)
  }
  const recipients = await requirePlayer(gameId, user)
  if (!limiter.take(user.id)) throw new ClientError("You're sending messages too quickly")

  const message: ChatMessage = {
    id: randomUUID(),
    gameId,
    userId: user.id,
    name: user.name,
    body,
    createdAt: Date.now(),
  }
  // A just-created game may still be on its way to the database; the message row references it.
  await gameManager.whenSaved(gameId)
  await repo.insertMessage(message)
  return { message, recipients }
}
