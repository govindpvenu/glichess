export type TimeControlCategory = "bullet" | "blitz" | "rapid"

export interface TimeControl {
  id: string
  /** Base time per player, in seconds. */
  initial: number
  /** Seconds added after each move. */
  increment: number
  category: TimeControlCategory
}

export const TIME_CONTROLS = [
  { id: "1+0", initial: 60, increment: 0, category: "bullet" },
  { id: "3+2", initial: 180, increment: 2, category: "blitz" },
  { id: "5+0", initial: 300, increment: 0, category: "blitz" },
  { id: "10+0", initial: 600, increment: 0, category: "rapid" },
  { id: "15+10", initial: 900, increment: 10, category: "rapid" },
] as const satisfies readonly TimeControl[]

export type TimeControlId = (typeof TIME_CONTROLS)[number]["id"]

export function getTimeControl(id: string): TimeControl | undefined {
  return TIME_CONTROLS.find((tc) => tc.id === id)
}
