/** Longest chat message accepted, in UTF-16 code units (what `<input maxLength>` counts). */
export const CHAT_MAX_LENGTH = 280

/** A message in a game's chat. Only the two players can read and write it. */
export interface ChatMessage {
  id: string
  gameId: string
  /** Null once the author's account has been deleted. */
  userId: string | null
  /** Author's display name when the message was sent. */
  name: string
  body: string
  createdAt: number
}
