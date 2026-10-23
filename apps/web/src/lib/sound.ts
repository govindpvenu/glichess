import { useSyncExternalStore } from "react"

import { audioContext } from "@/lib/audio"

type SoundFile = "move" | "capture" | "promote" | "notify"

const FILES: Record<SoundFile, string> = {
  move: "/sounds/move-self.mp3",
  capture: "/sounds/capture.mp3",
  promote: "/sounds/promote.mp3",
  notify: "/sounds/notify.mp3",
}

/** Game sounds come from files; "message" (a new chat message) is a short synthesized blip. */
export type Sound = SoundFile | "message"

const VOLUME = 0.7
const STORAGE_KEY = "glichess-sound"

const files = new Map<SoundFile, Promise<ArrayBuffer | null>>()
const buffers = new Map<SoundFile, Promise<AudioBuffer | null>>()

/** Downloads the sound files ahead of the first move. Needs no AudioContext, so it is safe on load. */
export function preloadSounds() {
  for (const name of ["move", "capture", "promote", "notify"] as const) void fetchFile(name)
}

function fetchFile(name: SoundFile) {
  let file = files.get(name)
  if (!file) {
    file = fetch(FILES[name])
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null)
    files.set(name, file)
  }
  return file
}

function decode(ctx: AudioContext, name: SoundFile) {
  let buffer = buffers.get(name)
  if (!buffer) {
    buffer = fetchFile(name).then((data) =>
      data ? ctx.decodeAudioData(data).catch(() => null) : null,
    )
    buffers.set(name, buffer)
  }
  return buffer
}

/**
 * Plays a sound unless sounds are off. Silently skips if the browser hasn't allowed audio yet
 * (no click or key press on the page), rather than queueing sounds to burst out later.
 */
export function playSound(sound: Sound) {
  if (!soundEnabled()) return
  const ctx = audioContext()
  if (ctx.state !== "running") return

  if (sound === "message") {
    blip(ctx)
    return
  }
  void decode(ctx, sound).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = VOLUME
    source.connect(gain).connect(ctx.destination)
    source.start()
  })
}

/** Two soft rising notes: quieter and shorter than the game sounds, so chat never drowns them. */
function blip(ctx: AudioContext) {
  const start = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
  const osc = ctx.createOscillator()
  osc.type = "sine"
  osc.frequency.setValueAtTime(740, start)
  osc.frequency.setValueAtTime(988, start + 0.07)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + 0.25)
}

/** The sound setting, kept in localStorage and shared across tabs. */
const listeners = new Set<() => void>()

function soundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, "off")
  } catch {
    // Storage blocked: the setting just won't persist.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useSoundEnabled() {
  return useSyncExternalStore(subscribe, soundEnabled)
}

/** The sound for a move, from its SAN: promotion, then capture, else a plain move. */
export function moveSound(san: string): Sound {
  if (san.includes("=")) return "promote"
  if (san.includes("x")) return "capture"
  return "move"
}
