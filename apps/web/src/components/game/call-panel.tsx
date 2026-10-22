import { otherColor, type Color, type GamePlayer, type GameSnapshot } from "@glichess/shared"
import { LoaderCircle, Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { useSpeaking } from "@/hooks/use-speaking"
import type { CallSession, CallState, CallStatus, MediaKind } from "@/lib/call/call-session"
import { cn } from "@/lib/utils"

const statusText: Record<CallStatus, string> = {
  joining: "Joining",
  waiting: "Opponent away",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  failed: "Couldn't connect",
  replaced: "Open in another tab",
  unavailable: "Unavailable",
}

export function CallPanel({
  snapshot,
  myColor,
  session,
  state,
}: {
  snapshot: GameSnapshot
  myColor: Color
  session: CallSession
  state: CallState
}) {
  const opponent = snapshot[otherColor(myColor)]
  const { remoteStream, remoteMedia, localStream } = state
  const live = state.status === "connected" || state.status === "reconnecting"

  const remoteSpeaking = useSpeaking(
    live && remoteMedia.audio ? (remoteStream?.getAudioTracks()[0] ?? null) : null,
  )
  const localSpeaking = useSpeaking(state.audio ? (localStream?.getAudioTracks()[0] ?? null) : null)

  const remoteVideo = live && remoteMedia.video && remoteStream ? remoteStream : null
  const localVideo = state.video ? localStream : null
  const showStage = remoteVideo !== null || localVideo !== null
  const action =
    state.status === "failed"
      ? { label: "Retry", run: session.rejoin }
      : state.status === "replaced"
        ? { label: "Use here", run: session.rejoin }
        : null

  return (
    <section aria-label="Video call" className="shrink-0 overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="label-mono">Call</h2>
        <span className="flex items-center gap-1.5 label-mono">
          <span
            className={cn(
              "size-1.5 rounded-full",
              state.status === "connected"
                ? "bg-success"
                : state.status === "failed" || state.status === "unavailable"
                  ? "bg-destructive"
                  : "bg-muted-foreground/40",
            )}
          />
          {statusText[state.status]}
        </span>
      </header>

      {showStage && (
        <div className="relative aspect-video bg-neutral-950">
          {remoteVideo ? (
            <StreamVideo stream={remoteVideo} label={`${opponent?.name ?? "Opponent"}'s camera`} />
          ) : (
            <div className="grid size-full place-items-center">
              {opponent && <UserAvatar user={opponent} size="lg" />}
            </div>
          )}
          <SpeakingRing active={remoteSpeaking} />

          {localVideo && (
            <div className="absolute right-2 bottom-2 aspect-video w-[32%] overflow-hidden rounded-md border border-white/15 bg-black shadow-lg">
              <StreamVideo stream={localVideo} label="Your camera" mirrored />
              <SpeakingRing active={localSpeaking} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        {!showStage && opponent && (
          <UserAvatar
            user={opponent}
            className={cn(
              "ring-2 ring-transparent ring-offset-2 ring-offset-card transition-[--tw-ring-color]",
              remoteSpeaking && "ring-signal",
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{opponent?.name}</span>
            {live && !remoteMedia.audio && (
              <MicOff
                aria-label="Opponent's microphone is off"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </div>
          <OpponentLine opponent={opponent} live={live} action={action} />
        </div>
        <DeviceToggle
          kind="audio"
          state={state}
          speaking={localSpeaking}
          onToggle={session.toggle}
        />
        <DeviceToggle kind="video" state={state} speaking={false} onToggle={session.toggle} />
      </div>

      {state.error && (
        <p role="alert" className="border-t px-4 py-2.5 text-xs text-destructive">
          {state.error}
        </p>
      )}

      <RemoteAudio stream={live ? remoteStream : null} name={opponent?.name ?? "your opponent"} />
    </section>
  )
}

function OpponentLine({
  opponent,
  live,
  action,
}: {
  opponent: GamePlayer | null
  live: boolean
  action: { label: string; run: () => void } | null
}) {
  if (action) {
    return (
      <button
        type="button"
        onClick={action.run}
        className="mt-1 label-mono text-foreground underline-offset-4 hover:underline"
      >
        {action.label}
      </button>
    )
  }
  return (
    <p className="mt-1 label-mono">{live ? "In call" : opponent?.isGuest ? "Guest" : "Opponent"}</p>
  )
}

function DeviceToggle({
  kind,
  state,
  speaking,
  onToggle,
}: {
  kind: MediaKind
  state: CallState
  speaking: boolean
  onToggle: (kind: MediaKind) => void
}) {
  const on = state[kind]
  const pending = state.pending[kind]
  const device = kind === "audio" ? "microphone" : "camera"
  const [OnIcon, OffIcon] = kind === "audio" ? [Mic, MicOff] : [Video, VideoOff]

  return (
    <Button
      type="button"
      variant={on ? "outline" : "secondary"}
      size="icon-sm"
      aria-pressed={on}
      aria-label={`${on ? "Turn off" : "Turn on"} ${device}`}
      title={`${on ? "Turn off" : "Turn on"} ${device}`}
      disabled={pending || state.status === "replaced"}
      onClick={() => onToggle(kind)}
      className={cn(
        "transition-shadow",
        !on && "text-muted-foreground",
        speaking && "ring-2 ring-signal",
      )}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : on ? <OnIcon /> : <OffIcon />}
    </Button>
  )
}

function SpeakingRing({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-signal transition-opacity duration-150 ring-inset",
        active ? "opacity-100" : "opacity-0",
      )}
    />
  )
}

/** Muted video for display; sound plays through RemoteAudio so it keeps going without video. */
function StreamVideo({
  stream,
  label,
  mirrored,
}: {
  stream: MediaStream
  label: string
  mirrored?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [stream])

  return (
    <video
      ref={ref}
      aria-label={label}
      autoPlay
      playsInline
      muted
      className={cn("size-full object-cover", mirrored && "-scale-x-100")}
    />
  )
}

/**
 * Plays the opponent's audio. Browsers may refuse to start audio before the user has interacted
 * with the page; then a button asks for the click that unlocks it.
 */
function RemoteAudio({ stream, name }: { stream: MediaStream | null; name: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    audio.srcObject = stream
    if (!stream) return
    audio.play().then(
      () => setBlocked(false),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true)
      },
    )
  }, [stream])

  const unlock = () => {
    ref.current?.play().then(
      () => setBlocked(false),
      () => {},
    )
  }

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- live call audio has no caption track */}
      <audio ref={ref} autoPlay />
      {blocked && stream && (
        <button
          type="button"
          onClick={unlock}
          className="flex w-full items-center justify-center gap-2 border-t px-4 py-2.5 text-xs font-medium hover:bg-accent"
        >
          <Volume2 className="size-3.5" />
          Click to hear {name}
        </button>
      )}
    </>
  )
}
