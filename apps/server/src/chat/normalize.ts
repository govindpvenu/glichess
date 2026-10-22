/** Collapses whitespace and control characters into single spaces and trims the ends. */
export function normalizeMessage(body: string) {
  return body.replace(/[\s\p{Cc}]+/gu, " ").trim()
}
