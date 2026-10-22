import type { ClientToServerEvents, ServerToClientEvents } from "@glichess/shared"
import { io, type Socket } from "socket.io-client"

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Single shared connection. Same origin as the page: Vite proxies it in dev, Express serves both in prod. */
export const socket: AppSocket = io({
  transports: ["websocket", "polling"],
})

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

let status: ConnectionStatus = socket.connected ? "connected" : "connecting"
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

export const connectionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => status,
}
