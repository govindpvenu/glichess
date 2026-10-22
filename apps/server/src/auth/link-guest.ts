import { logger } from "../logger"

interface LinkedUsers {
  guestId: string
  accountId: string
}

/**
 * Runs when a guest signs in with Google. Better Auth deletes the guest user right after,
 * so anything the guest owns must be re-pointed to the Google account here.
 * Games and chat history join this transfer once those tables exist.
 */
export async function transferGuestData({ guestId, accountId }: LinkedUsers) {
  logger.info({ guestId, accountId }, "guest linked to account")
}
