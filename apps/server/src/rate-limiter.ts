/** Above this many tracked keys, buckets that have refilled completely are dropped. */
const PRUNE_THRESHOLD = 10_000

/**
 * Token bucket per key: allows a burst of `capacity` actions, then one more every `refillMs`.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>()
  private readonly capacity: number
  private readonly refillMs: number

  constructor({ capacity, refillMs }: { capacity: number; refillMs: number }) {
    this.capacity = capacity
    this.refillMs = refillMs
  }

  /** Spends one token for `key`; returns false if none are left. */
  take(key: string, now = Date.now()) {
    if (this.buckets.size > PRUNE_THRESHOLD) this.prune(now)
    const tokens = this.tokens(key, now)
    const allowed = tokens >= 1
    this.buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, at: now })
    return allowed
  }

  private tokens(key: string, now: number) {
    const bucket = this.buckets.get(key)
    if (!bucket) return this.capacity
    return Math.min(this.capacity, bucket.tokens + (now - bucket.at) / this.refillMs)
  }

  private prune(now: number) {
    for (const key of this.buckets.keys()) {
      if (this.tokens(key, now) >= this.capacity) this.buckets.delete(key)
    }
  }
}
