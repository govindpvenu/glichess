import { isGameOver, type GameSnapshot } from "@glichess/shared"
import { useEffect, useRef } from "react"

import { moveSound, playSound, preloadSounds } from "@/lib/sound"

/**
 * Plays a sound for each change to the game: a move (yours shows optimistically, so it sounds
 * at once), the opponent joining, and the end. The first snapshot after opening the page is
 * silent, so reloading or reconnecting doesn't replay anything.
 */
export function useGameSounds(snapshot: GameSnapshot | null) {
  const previous = useRef<GameSnapshot | null>(null)

  useEffect(preloadSounds, [])

  useEffect(() => {
    const prev = previous.current
    previous.current = snapshot
    if (!prev || !snapshot || prev.id !== snapshot.id) return

    const last = snapshot.moves.at(-1)
    // Several new moves at once (catching up after a reconnect) get one sound, for the latest.
    if (last && snapshot.moves.length > prev.moves.length) playSound(moveSound(last.san))

    const started = prev.status === "waiting" && snapshot.status === "active"
    const ended = !isGameOver(prev.status) && isGameOver(snapshot.status)
    if (started || ended) playSound("notify")
  }, [snapshot])
}
