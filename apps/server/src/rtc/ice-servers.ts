import type { IceServer } from "@glichess/shared"
import { z } from "zod"

import { env } from "../env"
import { logger } from "../logger"

const STUN_ONLY: IceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }]

/** Credentials outlive any game plus the chat afterwards; TURN allocations can't refresh past this. */
const CREDENTIAL_TTL_S = 4 * 60 * 60

const responseSchema = z.object({
  iceServers: z.array(
    z.object({
      urls: z.union([z.string(), z.array(z.string())]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  ),
})

/** Browsers block port 53, so a URL on it would only time out. */
const usable = (url: string) => !/:53(\?|$)/.test(url)

/**
 * Short-lived TURN credentials from Cloudflare, generated per call join so they can't be shared
 * for long. Falls back to STUN only if TURN isn't configured or Cloudflare can't be reached.
 */
export async function getIceServers(): Promise<IceServer[]> {
  const keyId = env.CLOUDFLARE_TURN_KEY_ID
  const token = env.CLOUDFLARE_TURN_API_TOKEN
  if (!keyId || !token) return STUN_ONLY

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_S }),
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!response.ok) throw new Error(`Cloudflare TURN responded ${response.status}`)
    const { iceServers } = responseSchema.parse(await response.json())
    return iceServers.map((server) => ({
      ...server,
      urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(usable),
    }))
  } catch (error) {
    logger.warn({ err: error }, "TURN credentials unavailable; falling back to STUN")
    return STUN_ONLY
  }
}
