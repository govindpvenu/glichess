import type { Ack, AckResult } from "@glichess/shared"
import { z } from "zod"

import { ClientError } from "./errors"
import { logger } from "./logger"

export const gameIdSchema = z.string().min(1).max(32)

/**
 * Wraps a socket event handler: validates the payload, runs the handler and always answers the
 * ack. ClientErrors and bad input go back to the client; anything else is logged and hidden.
 */
export function handle<S extends z.ZodType, T>(schema: S, run: (input: z.infer<S>) => Promise<T>) {
  return (payload: unknown, ack: Ack<T>) => {
    const reply = (result: AckResult<T>) => {
      if (typeof ack === "function") ack(result)
    }
    const parsed = schema.safeParse(payload)
    if (!parsed.success) return reply({ ok: false, error: "Invalid request" })
    run(parsed.data).then(
      (data) => reply({ ok: true, data }),
      (error: unknown) => {
        if (error instanceof ClientError) return reply({ ok: false, error: error.message })
        logger.error({ err: error }, "socket handler failed")
        reply({ ok: false, error: "Something went wrong" })
      },
    )
  }
}
