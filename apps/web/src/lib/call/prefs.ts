import type { GameSource, MediaState } from "@glichess/shared"

const key = (gameId: string) => `glichess-call:${gameId}`

/**
 * Camera and mic start on in invite games (you're playing someone you know) and off with
 * strangers from the queue. Rematches inherit whatever was chosen in the previous game.
 */
export function defaultMedia(source: GameSource): MediaState {
  const on = source === "invite"
  return { audio: on, video: on }
}

/** The last choice for a game in this tab, so a reload or rematch keeps it. */
export function loadCallPrefs(gameId: string): MediaState | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key(gameId)) ?? "null")
    if (
      typeof value === "object" &&
      value !== null &&
      "audio" in value &&
      "video" in value &&
      typeof value.audio === "boolean" &&
      typeof value.video === "boolean"
    ) {
      return { audio: value.audio, video: value.video }
    }
  } catch {
    // Storage disabled or a corrupt entry: use the defaults.
  }
  return null
}

export function saveCallPrefs(gameId: string, media: MediaState) {
  try {
    sessionStorage.setItem(key(gameId), JSON.stringify(media))
  } catch {
    // Not worth surfacing; the defaults apply next time.
  }
}
