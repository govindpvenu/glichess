import type { PublicUser } from "@glichess/shared"

import { gameManager } from "../game"
import { transferGames } from "../game/repository"
import { logger } from "../logger"

interface LinkedUsers {
  guestId: string
  account: PublicUser
}

/**
 * Runs when a guest signs in with Google. Better Auth deletes the guest user right after,
 * so everything the guest owns is re-pointed to the account first.
 */
export async function transferGuestData({ guestId, account }: LinkedUsers) {
  await transferGames(guestId, account.id)
  gameManager.transferUser(guestId, account)
  logger.info({ guestId, accountId: account.id }, "guest linked to account")
}
