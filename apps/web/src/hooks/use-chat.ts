import type { ChatMessage } from "@glichess/shared"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useSession } from "@/lib/session"
import { ACK_TIMEOUT_MS, ackError, socket } from "@/lib/socket"

export interface ChatEntry extends ChatMessage {
  /** Shown straight away while the server confirms it. */
  pending?: boolean
}

/** Adds messages by id (so repeats are ignored) and keeps unconfirmed ones at the end. */
function merge(current: ChatEntry[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const message of incoming) byId.set(message.id, message)
  return Array.from(byId.values()).toSorted(
    (a, b) => Number(!!a.pending) - Number(!!b.pending) || a.createdAt - b.createdAt,
  )
}

/**
 * A game's chat: loads the history (again after every reconnect, to fill any gap), listens for
 * new messages, and sends with an optimistic entry.
 */
export function useChat(gameId: string, enabled: boolean) {
  const { user } = useSession()
  const [messages, setMessages] = useState<ChatEntry[]>([])

  useEffect(() => {
    if (!enabled) return
    let active = true
    const receive = (message: ChatMessage) => {
      if (active && message.gameId === gameId) setMessages((current) => merge(current, [message]))
    }
    const load = () => {
      socket.emit("chat:history", { gameId }, (res) => {
        if (active && res.ok) setMessages((current) => merge(current, res.data))
      })
    }

    socket.on("chat:message", receive)
    socket.on("connect", load)
    if (socket.connected) load()
    return () => {
      active = false
      socket.off("chat:message", receive)
      socket.off("connect", load)
    }
  }, [gameId, enabled])

  /** Resolves to false if the message wasn't delivered. */
  const send = useCallback(
    (body: string) =>
      new Promise<boolean>((resolve) => {
        if (!user) return resolve(false)
        const pending: ChatEntry = {
          id: `pending-${crypto.randomUUID()}`,
          gameId,
          userId: user.id,
          name: user.name,
          body,
          createdAt: Date.now(),
          pending: true,
        }
        setMessages((current) => [...current, pending])

        socket.timeout(ACK_TIMEOUT_MS).emit("chat:send", { gameId, body }, (err, res) => {
          const error = ackError(err, res)
          setMessages((current) => {
            const rest = current.filter((m) => m.id !== pending.id)
            return !error && res.ok ? merge(rest, [res.data]) : rest
          })
          if (error) toast.error(error)
          resolve(!error)
        })
      }),
    [gameId, user],
  )

  return { messages, send }
}
