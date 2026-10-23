import { isGameOver, otherColor, type Color, type GameSnapshot } from "@glichess/shared"
import { useEffect, useRef, useState } from "react"

import { describeResult } from "@/lib/format"

/** A line in the chat describing something that happened in the game. */
export interface GameEvent {
  id: string
  text: string
  /** Estimated server time, so events sort among chat messages (which carry server times). */
  at: number
}

let nextId = 0

/**
 * Turns changes between snapshots into chat notices: draw and rematch offers, the opponent
 * leaving and coming back, and the result. Only changes seen while the page is open produce
 * notices; they are not stored.
 */
export function useGameEvents(snapshot: GameSnapshot | null, offset: number) {
  const previous = useRef<GameSnapshot | null>(null)
  /** Players announced as having left, so only they are announced coming back. */
  const away = useRef(new Set<Color>())
  const [events, setEvents] = useState<GameEvent[]>([])

  useEffect(() => {
    const prev = previous.current
    previous.current = snapshot
    if (!prev || !snapshot || prev.id !== snapshot.id) return

    const texts = describeChanges(prev, snapshot, away.current)
    if (texts.length === 0) return
    const at = Date.now() + offset
    setEvents((current) => [
      ...current,
      ...texts.map((text) => ({ id: `event-${++nextId}`, text, at })),
    ])
  }, [snapshot, offset])

  return events
}

function describeChanges(prev: GameSnapshot, next: GameSnapshot, away: Set<Color>) {
  const name = (color: Color) => next[color]?.name ?? (color === "white" ? "White" : "Black")
  const texts: string[] = []

  if (prev.status === "waiting" && next.status === "active") texts.push("Game started")

  if (next.status === "active") {
    if (next.drawOfferBy && next.drawOfferBy !== prev.drawOfferBy) {
      texts.push(`${name(next.drawOfferBy)} offers a draw`)
    } else if (prev.drawOfferBy && !next.drawOfferBy) {
      texts.push("Draw offer declined")
    }
    for (const color of ["white", "black"] as const) {
      if (prev.status === "active" && prev.connected[color] && !next.connected[color]) {
        away.add(color)
        texts.push(`${name(color)} left`)
      } else if (away.has(color) && next.connected[color]) {
        away.delete(color)
        texts.push(`${name(color)} is back`)
      }
    }
  }

  const result = describeResult(next)
  if (result && !isGameOver(prev.status)) texts.push(`${result.title} · ${result.detail}`)

  if (isGameOver(next.status)) {
    if (next.rematchOfferBy && next.rematchOfferBy !== prev.rematchOfferBy) {
      texts.push(`${name(next.rematchOfferBy)} wants a rematch`)
    } else if (prev.rematchOfferBy && !next.rematchOfferBy && !next.rematchGameId) {
      texts.push(`${name(otherColor(prev.rematchOfferBy))} declined the rematch`)
    }
  }
  return texts
}
