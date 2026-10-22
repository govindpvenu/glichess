import { GameManager } from "./manager"
import { Matchmaking } from "./matchmaking"

/** Process-wide singletons. The server runs as one instance, so in-memory state is authoritative. */
export const gameManager = new GameManager()
export const matchmaking = new Matchmaking()

export { GameError, gameRoom } from "./manager"
