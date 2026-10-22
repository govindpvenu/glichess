/*
 * WebRTC signalling contract. The DOM's RTC types aren't available to the server, so the shapes
 * that cross the wire are declared here; they match what the browser APIs accept and return.
 */

/** An ICE server for RTCPeerConnection, e.g. Cloudflare's STUN and TURN relays. */
export interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface RtcDescription {
  type: "offer" | "answer"
  sdp: string
}

export interface RtcCandidate {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

export type RtcSignal = { description: RtcDescription } | { candidate: RtcCandidate }

/** Which of their devices a player is sending. */
export interface MediaState {
  audio: boolean
  video: boolean
}

export interface CallJoined {
  iceServers: IceServer[]
  /** Identifies this pairing of the two players' tabs; signals from other sessions are stale. */
  session: number
  /** Whether the opponent is already in the call. */
  peerPresent: boolean
}
