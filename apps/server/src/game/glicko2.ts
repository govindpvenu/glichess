/**
 * Glicko-2 rating update (Glickman, http://www.glicko.net/glicko/glicko2.pdf).
 * Each game is treated as its own rating period, as most online chess sites do.
 */

export interface Rating {
  rating: number
  deviation: number
  volatility: number
}

export const DEFAULT_RATING: Rating = { rating: 1500, deviation: 350, volatility: 0.06 }

/** System constant: how much volatility can change. 0.3–1.2 is typical; lower is more stable. */
const TAU = 0.5
const SCALE = 173.7178
const EPSILON = 0.000001
/** Keeps established players' ratings responsive and new players' bounded. */
const MIN_DEVIATION = 45
const MAX_DEVIATION = 350

/** `score` is 1 for a win, 0.5 for a draw, 0 for a loss, from `player`'s point of view. */
export function updateRating(
  player: Rating,
  opponents: { rating: Rating; score: number }[],
): Rating {
  const mu = (player.rating - 1500) / SCALE
  const phi = player.deviation / SCALE
  const sigma = player.volatility

  if (opponents.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma)
    return { ...player, deviation: clampDeviation(phiStar * SCALE) }
  }

  const games = opponents.map(({ rating, score }) => {
    const muJ = (rating.rating - 1500) / SCALE
    const g = 1 / Math.sqrt(1 + (3 * (rating.deviation / SCALE) ** 2) / Math.PI ** 2)
    const expected = 1 / (1 + Math.exp(-g * (mu - muJ)))
    return { g, expected, score }
  })

  const v = 1 / games.reduce((sum, { g, expected }) => sum + g * g * expected * (1 - expected), 0)
  const delta = v * games.reduce((sum, { g, expected, score }) => sum + g * (score - expected), 0)

  const newSigma = solveVolatility(delta, phi, v, sigma)
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma)
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const newMu =
    mu +
    newPhi * newPhi * games.reduce((sum, { g, expected, score }) => sum + g * (score - expected), 0)

  return {
    rating: newMu * SCALE + 1500,
    deviation: clampDeviation(newPhi * SCALE),
    volatility: newSigma,
  }
}

/** Step 5 of the paper: Illinois-method root finding for the new volatility. */
function solveVolatility(delta: number, phi: number, v: number, sigma: number) {
  const a = Math.log(sigma * sigma)
  const f = (x: number) => {
    const ex = Math.exp(x)
    const d = phi * phi + v + ex
    return (ex * (delta * delta - d)) / (2 * d * d) - (x - a) / (TAU * TAU)
  }

  let A = a
  let B: number
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v)
  } else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }

  let fA = f(A)
  let fB = f(B)
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA /= 2
    }
    B = C
    fB = fC
  }
  return Math.exp(A / 2)
}

function clampDeviation(deviation: number) {
  return Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, deviation))
}
