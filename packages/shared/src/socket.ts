/**
 * Typed Socket.IO contract shared by the server and the web client.
 * Events are namespaced as `<domain>:<action>`.
 */

export interface PongPayload {
  serverTime: number
}

export interface ServerToClientEvents {
  "system:welcome": (payload: { socketId: string; serverTime: number }) => void
}

export interface ClientToServerEvents {
  "system:ping": (ack: (payload: PongPayload) => void) => void
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketData {}
