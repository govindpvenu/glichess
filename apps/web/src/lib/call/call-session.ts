import type {
  CallJoined,
  Color,
  IceServer,
  MediaState,
  RtcDescription,
  RtcSignal,
} from "@glichess/shared"

import { socket } from "@/lib/socket"

import { saveCallPrefs } from "./prefs"

export type MediaKind = "audio" | "video"

export type CallStatus =
  /** Asking the server to enter the call. */
  | "joining"
  /** In the call; the opponent isn't. */
  | "waiting"
  | "connecting"
  | "connected"
  /** The connection dropped and ICE is trying to recover it. */
  | "reconnecting"
  | "failed"
  /** This player opened the call in another tab. */
  | "replaced"
  /** The server refused the call. */
  | "unavailable"

export interface CallState {
  status: CallStatus
  /** Your camera and mic, or null when both are off. */
  localStream: MediaStream | null
  audio: boolean
  video: boolean
  /** A device that is being started (waiting on the permission prompt). */
  pending: Record<MediaKind, boolean>
  error: string | null
  /** The opponent's tracks, present once negotiation has started. */
  remoteStream: MediaStream | null
  /** What the opponent says they're sending. */
  remoteMedia: MediaState
}

const OFF: MediaState = { audio: false, video: false }

const initialState = (): CallState => ({
  status: "joining",
  localStream: null,
  audio: false,
  video: false,
  pending: { audio: false, video: false },
  error: null,
  remoteStream: null,
  remoteMedia: OFF,
})

const constraints: Record<MediaKind, MediaStreamConstraints> = {
  audio: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
  video: {
    video: {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: "user",
    },
  },
}

/** ICE restarts to try after a failure before giving up and offering a manual retry. */
const MAX_ICE_RESTARTS = 2

/**
 * One player's side of a game's video call.
 *
 * Signalling goes through the game server. Negotiation follows the "perfect negotiation" pattern:
 * white is the impolite peer and creates both transceivers up front; black adopts them from the
 * offer. Devices are switched on and off with `replaceTrack`, so toggling never renegotiates.
 */
export class CallSession {
  private state = initialState()
  private readonly listeners = new Set<() => void>()
  private readonly gameId: string

  private running = false
  /** Bumped on stop so async work (permission prompts, acks) from a previous run is discarded. */
  private generation = 0
  private polite = true
  private iceServers: IceServer[] = []

  private session = -1
  private pc: RTCPeerConnection | null = null
  private transceivers: Record<MediaKind, RTCRtpTransceiver | null> = { audio: null, video: null }
  private makingOffer = false
  private ignoreOffer = false
  private iceRestarts = 0

  private tracks: Record<MediaKind, MediaStreamTrack | null> = { audio: null, video: null }
  /** Devices to switch back on if this tab takes the call back from another tab. */
  private suspended: MediaState = OFF

  constructor(gameId: string) {
    this.gameId = gameId
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.state

  start(color: Color, media: MediaState) {
    if (this.running) return
    this.running = true
    this.polite = color === "black"
    socket.on("rtc:peer", this.onPeer)
    socket.on("rtc:signal", this.onSignal)
    socket.on("rtc:media", this.onMedia)
    socket.on("rtc:replaced", this.onReplaced)
    socket.on("connect", this.onConnect)
    if (socket.connected) this.join()
    this.restoreMedia(media)
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.generation++
    socket.off("rtc:peer", this.onPeer)
    socket.off("rtc:signal", this.onSignal)
    socket.off("rtc:media", this.onMedia)
    socket.off("rtc:replaced", this.onReplaced)
    socket.off("connect", this.onConnect)
    if (socket.connected) socket.emit("rtc:leave", { gameId: this.gameId })
    this.closePeer()
    this.releaseTrack("audio")
    this.releaseTrack("video")
    this.state = initialState()
    this.emit()
  }

  /** Retries after a failure, or takes the call back from another tab. */
  rejoin = () => {
    if (!this.running) return
    this.join()
    this.restoreMedia(this.suspended)
    this.suspended = OFF
  }

  toggle = (kind: MediaKind) => {
    void this.setMedia(kind, !this.tracks[kind])
  }

  // ---- Signalling ----

  /** Re-enters the call after a reconnect, unless another tab has taken it over. */
  private onConnect = () => {
    if (this.state.status !== "replaced") this.join()
  }

  private join() {
    const generation = this.generation
    this.update({ status: "joining" })
    socket.emit("rtc:join", { gameId: this.gameId }, (res) => {
      if (generation !== this.generation) return
      if (!res.ok) return this.update({ status: "unavailable", error: res.error })
      this.joined(res.data)
    })
  }

  private joined({ iceServers, session, peerPresent }: CallJoined) {
    // A reply to an earlier join that arrived late.
    if (session < this.session) return
    this.iceServers = iceServers
    this.onPeer({ gameId: this.gameId, session, present: peerPresent })
  }

  private onPeer = ({
    gameId,
    session,
    present,
  }: {
    gameId: string
    session: number
    present: boolean
  }) => {
    if (gameId !== this.gameId || session < this.session || this.state.status === "replaced") return
    this.closePeer()
    this.session = session
    if (!present) {
      this.update({ status: "waiting", remoteStream: null, remoteMedia: OFF })
      return
    }
    this.createPeer()
    this.sendMedia()
  }

  private onSignal = (payload: { gameId: string; session: number; signal: RtcSignal }) => {
    if (payload.gameId !== this.gameId || payload.session !== this.session || !this.pc) return
    void this.handleSignal(this.pc, payload.signal)
  }

  private async handleSignal(pc: RTCPeerConnection, signal: RtcSignal) {
    try {
      if ("description" in signal) {
        const { description } = signal
        const collision =
          description.type === "offer" && (this.makingOffer || pc.signalingState !== "stable")
        this.ignoreOffer = !this.polite && collision
        if (this.ignoreOffer) return

        await pc.setRemoteDescription(description)
        if (description.type === "offer") {
          this.adoptTransceivers(pc)
          await pc.setLocalDescription()
          this.sendDescription(pc)
        }
      } else {
        try {
          await pc.addIceCandidate(signal.candidate)
        } catch (error) {
          // Candidates for an offer we deliberately ignored are expected to fail.
          if (!this.ignoreOffer) throw error
        }
      }
    } catch (error) {
      console.warn("call signalling failed", error)
    }
  }

  private onMedia = ({ gameId, media }: { gameId: string; media: MediaState }) => {
    if (gameId === this.gameId) this.update({ remoteMedia: media })
  }

  private onReplaced = ({ gameId }: { gameId: string }) => {
    if (gameId !== this.gameId) return
    this.closePeer()
    this.suspended = { audio: !!this.tracks.audio, video: !!this.tracks.video }
    // Free the camera and mic for the tab that now has the call.
    this.releaseTrack("audio")
    this.releaseTrack("video")
    this.update({
      ...this.localMediaState(),
      status: "replaced",
      remoteStream: null,
      remoteMedia: OFF,
    })
  }

  private signal(signal: RtcSignal) {
    socket.emit("rtc:signal", { gameId: this.gameId, session: this.session, signal })
  }

  private sendDescription(pc: RTCPeerConnection) {
    const description = pc.localDescription
    if (pc !== this.pc || !description) return
    if (description.type === "offer" || description.type === "answer") {
      const payload: RtcDescription = { type: description.type, sdp: description.sdp }
      this.signal({ description: payload })
    }
  }

  private sendMedia() {
    socket.emit("rtc:media", {
      gameId: this.gameId,
      media: { audio: !!this.tracks.audio, video: !!this.tracks.video },
    })
  }

  // ---- Peer connection ----

  private createPeer() {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })
    this.pc = pc
    this.makingOffer = false
    this.ignoreOffer = false
    this.iceRestarts = 0

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true
        await pc.setLocalDescription()
        this.sendDescription(pc)
      } catch (error) {
        console.warn("call negotiation failed", error)
      } finally {
        this.makingOffer = false
      }
    }
    pc.onicecandidate = ({ candidate }) => {
      // A null candidate marks the end of gathering; trickle ICE doesn't need it relayed.
      if (pc !== this.pc || !candidate) return
      this.signal({
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        },
      })
    }
    pc.onconnectionstatechange = () => this.onConnectionState(pc)

    this.update({ status: "connecting", remoteStream: null })
    if (!this.polite) {
      this.transceivers = {
        audio: pc.addTransceiver("audio", { direction: "sendrecv" }),
        video: pc.addTransceiver("video", { direction: "sendrecv" }),
      }
      this.attachTransceivers()
    }
  }

  /** The polite side uses the transceivers the offer created instead of adding its own. */
  private adoptTransceivers(pc: RTCPeerConnection) {
    if (this.transceivers.audio && this.transceivers.video) return
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind
      if ((kind === "audio" || kind === "video") && !this.transceivers[kind]) {
        transceiver.direction = "sendrecv"
        this.transceivers[kind] = transceiver
      }
    }
    this.attachTransceivers()
  }

  private attachTransceivers() {
    this.replaceTracks()
    const remote = [this.transceivers.audio, this.transceivers.video].flatMap((t) =>
      t ? [t.receiver.track] : [],
    )
    this.update({ remoteStream: new MediaStream(remote) })
  }

  private replaceTracks() {
    for (const kind of ["audio", "video"] as const) {
      this.transceivers[kind]?.sender.replaceTrack(this.tracks[kind]).catch((error: unknown) => {
        console.warn(`couldn't send ${kind}`, error)
      })
    }
  }

  private onConnectionState(pc: RTCPeerConnection) {
    if (pc !== this.pc) return
    switch (pc.connectionState) {
      case "connected":
        this.iceRestarts = 0
        this.update({ status: "connected" })
        break
      case "disconnected":
        this.update({ status: "reconnecting" })
        break
      case "failed":
        if (this.iceRestarts < MAX_ICE_RESTARTS) {
          this.iceRestarts++
          pc.restartIce()
          this.update({ status: "reconnecting" })
        } else {
          this.update({ status: "failed" })
        }
        break
      default:
        break
    }
  }

  private closePeer() {
    const pc = this.pc
    this.pc = null
    this.transceivers = { audio: null, video: null }
    if (!pc) return
    pc.onnegotiationneeded = null
    pc.onicecandidate = null
    pc.onconnectionstatechange = null
    pc.close()
  }

  // ---- Devices ----

  private restoreMedia(media: MediaState) {
    if (media.audio) void this.setMedia("audio", true)
    if (media.video) void this.setMedia("video", true)
  }

  private async setMedia(kind: MediaKind, on: boolean) {
    if (!this.running || this.state.pending[kind] || !!this.tracks[kind] === on) return
    if (!on) {
      this.releaseTrack(kind)
      this.afterMediaChange()
      return
    }

    const generation = this.generation
    this.update({ pending: { ...this.state.pending, [kind]: true }, error: null })
    try {
      if (!window.isSecureContext) throw new DOMException("Insecure context", "SecurityError")
      const stream = await navigator.mediaDevices.getUserMedia(constraints[kind])
      const [track] = stream.getTracks()
      if (generation !== this.generation || !track) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      // The device was unplugged or permission revoked mid-call.
      track.addEventListener("ended", () => {
        if (this.tracks[kind] !== track) return
        this.releaseTrack(kind)
        this.afterMediaChange()
      })
      this.tracks[kind] = track
      this.afterMediaChange()
    } catch (error) {
      if (generation === this.generation) this.update({ error: describeMediaError(error, kind) })
    } finally {
      if (generation === this.generation) {
        this.update({ pending: { ...this.state.pending, [kind]: false } })
      }
    }
  }

  private releaseTrack(kind: MediaKind) {
    this.tracks[kind]?.stop()
    this.tracks[kind] = null
  }

  private afterMediaChange() {
    this.replaceTracks()
    this.update(this.localMediaState())
    saveCallPrefs(this.gameId, { audio: !!this.tracks.audio, video: !!this.tracks.video })
    this.sendMedia()
  }

  private localMediaState() {
    const tracks = [this.tracks.audio, this.tracks.video].filter((t) => t !== null)
    return {
      audio: !!this.tracks.audio,
      video: !!this.tracks.video,
      // A new stream object each time, so video elements pick up the change.
      localStream: tracks.length > 0 ? new MediaStream(tracks) : null,
    }
  }

  // ---- State ----

  private update(changes: Partial<CallState>) {
    this.state = { ...this.state, ...changes }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }
}

function describeMediaError(error: unknown, kind: MediaKind) {
  const device = kind === "audio" ? "microphone" : "camera"
  const name = error instanceof DOMException ? error.name : ""
  switch (name) {
    case "NotAllowedError":
      return `Your ${device} is blocked. Allow it in your browser's site settings.`
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} found.`
    case "NotReadableError":
      return `Your ${device} is being used by another app.`
    case "SecurityError":
      return "Camera and microphone need a secure (https) connection."
    default:
      return `Couldn't start your ${device}.`
  }
}
