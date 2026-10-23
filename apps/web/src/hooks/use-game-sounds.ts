import { isGameOver, type Color, type GameSnapshot } from "@glichess/shared"
import { useEffect, useRef } from "react"

import { moveSound, playSound, preloadSounds, type Sound } from "@/lib/sound"

/**
 * Plays a sound for each change to the game: a move (yours shows optimistically, so it sounds
 * at once), the opponent joining, and the end. The first snapshot after opening the page is
 * silent, so reloading or reconnecting doesn't replay anything.
 */
export function useGameSounds(snapshot: GameSnapshot | null, myColor: Color | null) {
  const previous = useRef<GameSnapshot | null>(null)

  useEffect(preloadSounds, [])

  useEffect(() => {
    const prev = previous.current
    previous.current = snapshot
    if (!prev || !snapshot || prev.id !== snapshot.id) return

    // The end sound replaces the sound of the move that ended the game (e.g. checkmate).
    if (!isGameOver(prev.status) && isGameOver(snapshot.status)) {
      playSound(endSound(snapshot, myColor))
      return
    }

    const last = snapshot.moves.at(-1)
    // Several new moves at once (catching up after a reconnect) get one sound, for the latest.
    if (last && snapshot.moves.length > prev.moves.length) playSound(moveSound(last.san))

    if (prev.status === "waiting" && snapshot.status === "active") playSound("notify")
  }, [snapshot, myColor])
}

/** Victory or defeat for the players, a draw sound for draws, and a plain chime otherwise. */
function endSound(snapshot: GameSnapshot, myColor: Color | null): Sound {
  if (snapshot.result === "draw") return "draw"
  if (!snapshot.result || !myColor) return "notify"
  return snapshot.result === myColor ? "victory" : "defeat"
}
