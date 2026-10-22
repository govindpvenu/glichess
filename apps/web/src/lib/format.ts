import type { GameSnapshot, Termination } from "@glichess/shared"

/** 5:04, or 0:09.4 under ten seconds so the last moments are readable. */
export function formatClock(ms: number) {
  const clamped = Math.max(0, ms)
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100)
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`
  }
  const totalSeconds = Math.ceil(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function formatSeconds(ms: number) {
  return `${Math.ceil(ms / 1000)}s`
}

const terminationText: Record<Termination, string> = {
  checkmate: "by checkmate",
  resignation: "by resignation",
  timeout: "on time",
  abandonment: "by abandonment",
  stalemate: "by stalemate",
  threefold_repetition: "by threefold repetition",
  fifty_move_rule: "by the fifty-move rule",
  insufficient_material: "by insufficient material",
  timeout_vs_insufficient_material: "on time vs insufficient material",
  agreement: "by agreement",
  aborted: "",
}

export function describeResult(snapshot: GameSnapshot) {
  if (snapshot.status === "aborted")
    return { title: "Game aborted", detail: "No result was recorded." }
  if (snapshot.status !== "finished" || !snapshot.result) return null
  const how = snapshot.termination ? terminationText[snapshot.termination] : ""
  const title =
    snapshot.result === "draw" ? "Draw" : `${snapshot.result === "white" ? "White" : "Black"} wins`
  const score = snapshot.result === "white" ? "1–0" : snapshot.result === "black" ? "0–1" : "½–½"
  return { title, detail: `${score} · ${how}`.trim() }
}
