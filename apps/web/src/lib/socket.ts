import type { AckResult, ClientToServerEvents, ServerToClientEvents } from "@glichess/shared"
import { io, type Socket } from "socket.io-client"

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Single shared connection. Same origin as the page: Vite proxies it in dev, Express serves both in prod.
 * Connected by SessionProvider once a session cookie exists, since the server rejects anonymous handshakes.
 */
export const socket: AppSocket = io({
  autoConnect: false,
  transports: ["websocket", "polling"],
})

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

let status: ConnectionStatus = "connecting"
const listeners = new Set<() => void>()

function setStatus(next: ConnectionStatus) {
  if (next === status) return
  status = next
  listeners.forEach((listener) => listener())
}

socket.on("connect", () => setStatus("connected"))
socket.on("disconnect", () => setStatus("disconnected"))
socket.on("connect_error", () => setStatus("disconnected"))
socket.io.on("reconnect_attempt", () => setStatus("connecting"))

/** Opens a fresh connection, replacing any existing one (e.g. after the signed-in user changes). */
export function reconnectSocket() {
  setStatus("connecting")
  socket.disconnect().connect()
}

export const connectionStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot: () => status,
}

/** Error message for a failed or timed-out acknowledgement, or null on success. */
export function ackError(err: Error | null, res: AckResult<unknown> | undefined): string | null {
  if (err) return "The server didn't respond. Check your connection."
  if (res && !res.ok) return res.error
  return null
}
