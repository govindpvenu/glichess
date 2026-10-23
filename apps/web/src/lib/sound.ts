import { useSyncExternalStore } from "react"

import { audioContext } from "@/lib/audio"

/** Lichess's "sfx" set (AGPLv3+); see public/sounds/LICENSE.md. */
const SOUNDS = [
  "move",
  "capture",
  "check",
  "notify",
  "victory",
  "defeat",
  "draw",
  "message",
] as const

export type Sound = (typeof SOUNDS)[number]

/** Chat is quieter than the game, so a message never drowns out a move. */
const volume = (sound: Sound) => (sound === "message" ? 0.45 : 0.7)
const STORAGE_KEY = "glichess-sound"

const files = new Map<Sound, Promise<ArrayBuffer | null>>()
const buffers = new Map<Sound, Promise<AudioBuffer | null>>()

/** Downloads the sound files ahead of the first move. Needs no AudioContext, so it is safe on load. */
export function preloadSounds() {
  for (const sound of SOUNDS) void fetchFile(sound)
}

function fetchFile(sound: Sound) {
  let file = files.get(sound)
  if (!file) {
    file = fetch(`/sounds/${sound}.mp3`)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null)
    files.set(sound, file)
  }
  return file
}

function decode(ctx: AudioContext, sound: Sound) {
  let buffer = buffers.get(sound)
  if (!buffer) {
    buffer = fetchFile(sound).then((data) =>
      data ? ctx.decodeAudioData(data).catch(() => null) : null,
    )
    buffers.set(sound, buffer)
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

  void decode(ctx, sound).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = volume(sound)
    source.connect(gain).connect(ctx.destination)
    source.start()
  })
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

/** The sound for a move, from its SAN: check, then capture, else a plain move. */
export function moveSound(san: string): Sound {
  if (san.includes("+")) return "check"
  if (san.includes("x")) return "capture"
  return "move"
}
