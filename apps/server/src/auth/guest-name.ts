import { randomInt } from "node:crypto"

const adjectives = [
  "Bold",
  "Brave",
  "Calm",
  "Clever",
  "Quiet",
  "Swift",
  "Sly",
  "Keen",
  "Lucky",
  "Rapid",
  "Silent",
  "Steady",
  "Sharp",
  "Daring",
  "Wild",
  "Cosmic",
  "Iron",
  "Amber",
  "Velvet",
  "Frosty",
]

const nouns = [
  "Pawn",
  "Knight",
  "Bishop",
  "Rook",
  "Queen",
  "King",
  "Gambit",
  "Castle",
  "Fork",
  "Pin",
  "Tempo",
  "Endgame",
  "Zugzwang",
  "Fianchetto",
  "Outpost",
  "File",
  "Rank",
  "Check",
  "Sac",
  "Blitz",
]

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]!
}

/** Readable guest handle such as "SwiftRook482". Not guaranteed unique; names are display-only. */
export function generateGuestName() {
  return `${pick(adjectives)}${pick(nouns)}${randomInt(10, 1000)}`
}
