import { randomBytes } from "node:crypto"

import {
  getTimeControl,
  isGameOver,
  otherColor,
  type Color,
  type ColorPreference,
  type DrawAction,
  type GamePlayer,
  type GameSnapshot,
  type GameSource,
  type PublicUser,
  type RematchAction,
  type TimeControlPreset,
  type TimeControlId,
} from "@glichess/shared"

import { ClientError } from "../errors"
import { logger } from "../logger"
import { GameEngine, type ActionResult } from "./engine"
import { DEFAULT_RATING, updateRating, type Rating } from "./glicko2"
import * as repo from "./repository"

/** How long a disconnected player has to come back before the present opponent wins. */
export const ABANDON_MS = 60_000
/** Finished games stay in memory this long for rematches and late viewers. */
const FINISHED_TTL_MS = 30 * 60_000
/** Invites nobody accepted are cancelled after this long. */
const WAITING_TTL_MS = 2 * 60 * 60_000
const SWEEP_INTERVAL_MS = 5 * 60_000

export const gameRoom = (gameId: string) => `game:${gameId}`

export class GameError extends ClientError {}

interface Seat {
  user: PublicUser
  rating: Rating
  ratingDiff: number | null
}

interface LiveGame {
  id: string
  source: GameSource
  engine: GameEngine
  timeControl: TimeControlPreset
  rated: boolean
  creatorId: string | null
  creatorColor: ColorPreference | null
  white: Seat | null
  black: Seat | null
  rematchOfferBy: Color | null
  rematchGameId: string | null
  createdAt: number
  endedAt: number | null
  /** True while an opponent is being seated, so two simultaneous joiners can't both take the seat. */
  seating: boolean
  deadlineTimer: NodeJS.Timeout | null
  abandon: { color: Color; at: number; timer: NodeJS.Timeout } | null
  /** Open sockets per user in the game's room. */
  presence: Map<string, number>
  /** Writes for this game run in order on this chain. */
  persistence: Promise<void>
}

type Broadcast = (gameId: string, snapshot: GameSnapshot) => void

/**
 * Owns every live game. State lives in memory for fast moves; each change is queued to Postgres
 * in order, and unfinished games are restored from Postgres on boot.
 */
export class GameManager {
  private readonly games = new Map<string, LiveGame>()
  private broadcast: Broadcast = () => {}
  private sweepTimer: NodeJS.Timeout | null = null

  attach(broadcast: Broadcast) {
    this.broadcast = broadcast
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    this.sweepTimer.unref()
  }

  async restore() {
    const now = Date.now()
    const stored = await repo.loadLiveGames()
    for (const saved of stored) {
      const game = this.fromStored(saved, now)
      if (game) this.schedule(game)
    }
    logger.info({ count: stored.length }, "restored live games")
  }

  stop() {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    for (const game of this.games.values()) this.clearTimers(game)
  }

  /** Resolves once every queued database write has finished. */
  async flush() {
    await Promise.all(Array.from(this.games.values(), (game) => game.persistence))
  }

  // ---- Creating games ----

  createInvite(creator: PublicUser, timeControlId: TimeControlId, color: ColorPreference) {
    const timeControl = requireTimeControl(timeControlId)
    const game = this.newGame(timeControl, "invite", {
      creatorId: creator.id,
      creatorColor: color,
    })
    this.persist(game, () =>
      repo.insertGame({
        ...baseRow(game),
        creatorId: creator.id,
        creatorColor: color,
        source: game.source,
        status: "waiting",
      }),
    )
    return game.id
  }

  /** Starts a game between two known players (quick pairing or rematch). */
  async createMatch(
    players: { white: PublicUser; black: PublicUser },
    timeControlId: TimeControlId,
    options: { source: Exclude<GameSource, "invite">; rematchOfId?: string },
  ) {
    const timeControl = requireTimeControl(timeControlId)
    const profiles = await repo.getProfiles([players.white.id, players.black.id])
    const game = this.newGame(timeControl, options.source, { creatorId: null, creatorColor: null })
    this.seat(game, "white", players.white, profiles)
    this.seat(game, "black", players.black, profiles)

    const now = Date.now()
    game.engine.start(now)
    this.persist(game, () =>
      repo.insertGame({
        ...baseRow(game),
        ...seatColumns(game),
        source: game.source,
        rematchOfId: options.rematchOfId,
        status: "active",
        startedAt: new Date(now),
      }),
    )
    this.schedule(game)
    return game.id
  }

  // ---- Joining and presence ----

  /**
   * Opens a game for a user: seats them if it's an open invite and, unless this socket already
   * had it open, counts them as present.
   */
  async join(
    gameId: string,
    user: PublicUser,
    { countPresence }: { countPresence: boolean },
  ): Promise<GameSnapshot> {
    const game = this.games.get(gameId) ?? (await this.loadIntoMemory(gameId))
    if (!game) throw new GameError("Game not found")

    if (game.engine.status === "waiting" && !game.seating && user.id !== game.creatorId) {
      await this.acceptInvite(game, user)
    }

    if (countPresence) game.presence.set(user.id, (game.presence.get(user.id) ?? 0) + 1)
    this.afterChange(game)
    return this.snapshot(game)
  }

  leave(gameId: string, userId: string) {
    const game = this.games.get(gameId)
    if (!game) return
    const count = (game.presence.get(userId) ?? 0) - 1
    if (count > 0) game.presence.set(userId, count)
    else game.presence.delete(userId)
    this.afterChange(game)
  }

  // ---- Player actions ----

  move(gameId: string, user: PublicUser, uci: string, ply: number) {
    const { game, color } = this.playerGame(gameId, user)
    if (ply !== game.engine.ply) throw new GameError("Your board is out of date")
    const result = game.engine.move(color, uci, Date.now())
    if (result.ok) {
      const savedPly = game.engine.ply - 1
      const move = game.engine.moves[savedPly]!
      this.persist(game, () => repo.insertMove(game.id, savedPly, move))
      this.persistProgress(game)
    }
    this.finishAction(game, result)
  }

  resign(gameId: string, user: PublicUser) {
    const { game, color } = this.playerGame(gameId, user)
    this.finishAction(game, game.engine.resign(color, Date.now()))
  }

  abort(gameId: string, user: PublicUser) {
    const waiting = this.games.get(gameId)
    // The creator of an open invite isn't seated yet but may cancel it.
    if (waiting?.engine.status === "waiting" && waiting.creatorId === user.id) {
      this.finishAction(waiting, waiting.engine.abort())
      return
    }
    const { game } = this.playerGame(gameId, user)
    this.finishAction(game, game.engine.abort())
  }

  draw(gameId: string, user: PublicUser, action: DrawAction) {
    const { game, color } = this.playerGame(gameId, user)
    const now = Date.now()
    const result =
      action === "offer"
        ? game.engine.offerDraw(color, now)
        : action === "accept"
          ? game.engine.acceptDraw(color, now)
          : game.engine.declineDraw(color)
    this.finishAction(game, result)
  }

  async rematch(gameId: string, user: PublicUser, action: RematchAction) {
    const { game, color } = this.playerGame(gameId, user)
    if (!isGameOver(game.engine.status)) throw new GameError("The game is still in progress")
    if (game.rematchGameId) throw new GameError("A rematch has already started")

    if (action === "decline") {
      game.rematchOfferBy = null
      this.afterChange(game)
      return
    }
    if (game.rematchOfferBy !== otherColor(color)) {
      game.rematchOfferBy = color
      this.afterChange(game)
      return
    }

    // Both want a rematch: swap colours.
    const { white, black } = game
    if (!white || !black) throw new GameError("Both players are needed for a rematch")
    game.rematchGameId = "pending"
    try {
      game.rematchGameId = await this.createMatch(
        { white: black.user, black: white.user },
        game.timeControl.id,
        { source: "rematch", rematchOfId: game.id },
      )
    } catch (error) {
      game.rematchGameId = null
      throw error
    }
    game.rematchOfferBy = null
    this.afterChange(game)
  }

  /** The two players of a game, loading a finished game from the database if needed. */
  async players(gameId: string): Promise<{ white: PublicUser | null; black: PublicUser | null }> {
    const game = this.games.get(gameId) ?? (await this.loadIntoMemory(gameId))
    if (!game) throw new GameError("Game not found")
    return { white: game.white?.user ?? null, black: game.black?.user ?? null }
  }

  /** Resolves once the game's queued writes are saved, so rows can safely reference it. */
  async whenSaved(gameId: string) {
    await this.games.get(gameId)?.persistence
  }

  /** A guest signed in with Google: their live games now belong to the account. */
  transferUser(guestId: string, account: PublicUser) {
    for (const game of this.games.values()) {
      let changed = false
      for (const seat of [game.white, game.black]) {
        if (seat?.user.id === guestId) {
          seat.user = account
          changed = true
        }
      }
      if (game.creatorId === guestId) game.creatorId = account.id
      const present = game.presence.get(guestId)
      if (present !== undefined) {
        game.presence.delete(guestId)
        game.presence.set(account.id, (game.presence.get(account.id) ?? 0) + present)
      }
      if (changed) this.afterChange(game)
    }
  }

  // ---- Internals ----

  private newGame(
    timeControl: TimeControlPreset,
    source: GameSource,
    creator: { creatorId: string | null; creatorColor: ColorPreference | null },
  ): LiveGame {
    const game: LiveGame = {
      id: newGameId(),
      source,
      engine: new GameEngine({
        initialMs: timeControl.initial * 1000,
        incrementMs: timeControl.increment * 1000,
      }),
      timeControl,
      rated: false,
      ...creator,
      white: null,
      black: null,
      rematchOfferBy: null,
      rematchGameId: null,
      createdAt: Date.now(),
      endedAt: null,
      seating: false,
      deadlineTimer: null,
      abandon: null,
      presence: new Map(),
      persistence: Promise.resolve(),
    }
    this.games.set(game.id, game)
    return game
  }

  private async acceptInvite(game: LiveGame, joiner: PublicUser) {
    const creatorId = game.creatorId
    if (!creatorId) return
    game.seating = true
    try {
      const profiles = await repo.getProfiles([creatorId, joiner.id])
      const creator = profiles.get(creatorId)
      if (!creator || game.engine.status !== "waiting") return

      const creatorColor: Color =
        game.creatorColor === "random" || !game.creatorColor
          ? Math.random() < 0.5
            ? "white"
            : "black"
          : game.creatorColor
      this.seat(game, creatorColor, creator.user, profiles)
      this.seat(game, otherColor(creatorColor), joiner, profiles)

      const now = Date.now()
      game.engine.start(now)
      this.persist(game, () =>
        repo.updateGame(game.id, {
          ...seatColumns(game),
          status: "active",
          startedAt: new Date(now),
        }),
      )
    } finally {
      game.seating = false
    }
  }

  private seat(
    game: LiveGame,
    color: Color,
    user: PublicUser,
    profiles: Map<string, repo.PlayerProfile>,
  ) {
    const profile = profiles.get(user.id)
    game[color] = {
      user: profile?.user ?? user,
      rating: profile?.rating ?? DEFAULT_RATING,
      ratingDiff: null,
    }
    game.rated =
      !!game.white && !!game.black && !game.white.user.isGuest && !game.black.user.isGuest
  }

  private playerGame(gameId: string, user: PublicUser) {
    const game = this.games.get(gameId)
    if (!game) throw new GameError("Game not found")
    const color: Color | null =
      game.white?.user.id === user.id ? "white" : game.black?.user.id === user.id ? "black" : null
    if (!color) throw new GameError("You are not playing in this game")
    return { game, color }
  }

  private finishAction(game: LiveGame, result: ActionResult) {
    // Clock and first-move deadlines can end the game inside a failed action, so always settle state.
    this.afterChange(game)
    if (!result.ok) throw new GameError(result.error)
  }

  /** Runs after every mutation: settles a finished game, re-arms timers and broadcasts. */
  private afterChange(game: LiveGame) {
    const now = Date.now()
    if (isGameOver(game.engine.status) && game.endedAt === null) this.onGameOver(game, now)
    else this.schedule(game)
    this.updateAbandonment(game)
    this.broadcast(game.id, this.snapshot(game))
  }

  private onGameOver(game: LiveGame, now: number) {
    game.endedAt = now
    this.clearTimers(game)
    const engine = game.engine
    const finalState = {
      status: engine.status,
      result: engine.result,
      termination: engine.termination,
      fen: engine.fen,
      whiteMs: engine.whiteMs,
      blackMs: engine.blackMs,
      endedAt: new Date(now),
    }

    if (!game.rated || engine.status !== "finished" || !engine.result) {
      this.persist(game, () => repo.updateGame(game.id, finalState))
      return
    }

    // Ratings are read fresh at the end, in case either player finished another game meanwhile.
    this.persist(game, async () => {
      const white = game.white!
      const black = game.black!
      const profiles = await repo.getProfiles([white.user.id, black.user.id])
      const whiteBefore = profiles.get(white.user.id)?.rating ?? white.rating
      const blackBefore = profiles.get(black.user.id)?.rating ?? black.rating
      const score = engine.result === "white" ? 1 : engine.result === "black" ? 0 : 0.5
      const whiteAfter = updateRating(whiteBefore, [{ rating: blackBefore, score }])
      const blackAfter = updateRating(blackBefore, [{ rating: whiteBefore, score: 1 - score }])

      await repo.saveFinishedGame(
        game.id,
        {
          ...finalState,
          whiteRatingBefore: Math.round(whiteBefore.rating),
          whiteRatingAfter: Math.round(whiteAfter.rating),
          blackRatingBefore: Math.round(blackBefore.rating),
          blackRatingAfter: Math.round(blackAfter.rating),
        },
        [
          { userId: white.user.id, rating: whiteAfter },
          { userId: black.user.id, rating: blackAfter },
        ],
      )

      white.ratingDiff = Math.round(whiteAfter.rating) - Math.round(whiteBefore.rating)
      black.ratingDiff = Math.round(blackAfter.rating) - Math.round(blackBefore.rating)
      white.rating = whiteBefore
      black.rating = blackBefore
      this.broadcast(game.id, this.snapshot(game))
    })
  }

  /** Arms a single timer for the next first-move deadline or flag fall. */
  private schedule(game: LiveGame) {
    if (game.deadlineTimer) clearTimeout(game.deadlineTimer)
    game.deadlineTimer = null
    const at = game.engine.nextDeadline()
    if (at === null) return
    game.deadlineTimer = setTimeout(
      () => {
        game.deadlineTimer = null
        game.engine.checkDeadline(Date.now())
        this.afterChange(game)
      },
      Math.max(0, at - Date.now()) + 1,
    )
  }

  /** Starts the abandonment countdown when exactly one player has left an active game. */
  private updateAbandonment(game: LiveGame) {
    const away = (seat: Seat | null) => !!seat && !game.presence.has(seat.user.id)
    let leaver: Color | null = null
    if (game.engine.status === "active") {
      // If both are gone there is nobody to award the win to; the clock decides instead.
      if (away(game.white) && !away(game.black)) leaver = "white"
      else if (away(game.black) && !away(game.white)) leaver = "black"
    }
    if (game.abandon?.color === leaver) return
    if (game.abandon) clearTimeout(game.abandon.timer)
    game.abandon = null
    if (!leaver) return

    const color = leaver
    const at = Date.now() + ABANDON_MS
    const timer = setTimeout(() => {
      game.abandon = null
      game.engine.abandon(color, Date.now())
      this.afterChange(game)
    }, ABANDON_MS)
    game.abandon = { color, at, timer }
  }

  private clearTimers(game: LiveGame) {
    if (game.deadlineTimer) clearTimeout(game.deadlineTimer)
    if (game.abandon) clearTimeout(game.abandon.timer)
    game.deadlineTimer = null
    game.abandon = null
  }

  private persistProgress(game: LiveGame) {
    const { fen, whiteMs, blackMs } = game.engine
    this.persist(game, () => repo.updateGame(game.id, { fen, whiteMs, blackMs }))
  }

  private persist(game: LiveGame, task: () => Promise<unknown>) {
    game.persistence = game.persistence
      .then(task)
      .then(() => undefined)
      .catch((error: unknown) => {
        logger.error({ err: error, gameId: game.id }, "failed to save game")
      })
  }

  private snapshot(game: LiveGame): GameSnapshot {
    const engine = game.engine
    const present = (seat: Seat | null) => !!seat && game.presence.has(seat.user.id)
    return {
      id: game.id,
      status: engine.status,
      source: game.source,
      rated: game.rated,
      timeControl: {
        id: game.timeControl.id,
        initialMs: engine.initialMs,
        incrementMs: engine.incrementMs,
      },
      white: playerView(game.white),
      black: playerView(game.black),
      fen: engine.fen,
      moves: engine.moves,
      clock: engine.clock(),
      firstMoveDeadline:
        engine.status === "active" && engine.ply < 2 ? engine.firstMoveDeadline : null,
      drawOfferBy: engine.drawOfferBy,
      rematchOfferBy: game.rematchOfferBy,
      rematchGameId: game.rematchGameId === "pending" ? null : game.rematchGameId,
      result: engine.result,
      termination: engine.termination,
      connected: { white: present(game.white), black: present(game.black) },
      abandonDeadline: game.abandon && { color: game.abandon.color, at: game.abandon.at },
      serverNow: Date.now(),
    }
  }

  private async loadIntoMemory(gameId: string) {
    const saved = await repo.loadGame(gameId)
    if (!saved) return null
    // Another request may have loaded it while we were waiting on the database.
    return this.games.get(gameId) ?? this.fromStored(saved, Date.now())
  }

  private fromStored(saved: repo.StoredGame, now: number): LiveGame | null {
    const { row } = saved
    const timeControl = getTimeControl(row.timeControl)
    if (!timeControl) return null

    const engine = GameEngine.restore(
      {
        status: row.status,
        initialMs: row.initialMs,
        incrementMs: row.incrementMs,
        moves: saved.moves,
        whiteMs: row.whiteMs,
        blackMs: row.blackMs,
        result: row.result,
        termination: row.termination,
      },
      now,
    )

    const game: LiveGame = {
      id: row.id,
      source: row.source,
      engine,
      timeControl,
      rated: row.rated,
      creatorId: row.creatorId,
      creatorColor: row.creatorColor,
      white: toSeat(saved.white, row.whiteRatingBefore, row.whiteRatingAfter),
      black: toSeat(saved.black, row.blackRatingBefore, row.blackRatingAfter),
      rematchOfferBy: null,
      rematchGameId: null,
      createdAt: row.createdAt.getTime(),
      endedAt: isGameOver(row.status) ? now : null,
      seating: false,
      deadlineTimer: null,
      abandon: null,
      presence: new Map(),
      persistence: Promise.resolve(),
    }
    this.games.set(game.id, game)
    return game
  }

  /** Cancels stale invites and drops finished games from memory. */
  private sweep() {
    const now = Date.now()
    for (const game of this.games.values()) {
      if (game.engine.status === "waiting" && now - game.createdAt > WAITING_TTL_MS) {
        game.engine.abort()
        this.afterChange(game)
      } else if (game.endedAt !== null && now - game.endedAt > FINISHED_TTL_MS) {
        this.games.delete(game.id)
      }
    }
  }
}

function playerView(seat: Seat | null): GamePlayer | null {
  return (
    seat && {
      ...seat.user,
      rating: seat.user.isGuest ? null : Math.round(seat.rating.rating),
      ratingDiff: seat.ratingDiff,
    }
  )
}

function toSeat(
  profile: repo.PlayerProfile | null,
  ratingBefore: number | null,
  ratingAfter: number | null,
): Seat | null {
  return (
    profile && {
      user: profile.user,
      rating: ratingBefore === null ? profile.rating : { ...profile.rating, rating: ratingBefore },
      ratingDiff: ratingBefore !== null && ratingAfter !== null ? ratingAfter - ratingBefore : null,
    }
  )
}

function requireTimeControl(id: string) {
  const timeControl = getTimeControl(id)
  if (!timeControl) throw new GameError("Unknown time control")
  return timeControl
}

function baseRow(game: LiveGame) {
  return {
    id: game.id,
    timeControl: game.timeControl.id,
    initialMs: game.engine.initialMs,
    incrementMs: game.engine.incrementMs,
    fen: game.engine.fen,
    whiteMs: game.engine.whiteMs,
    blackMs: game.engine.blackMs,
  }
}

function seatColumns(game: LiveGame) {
  return {
    whiteId: game.white?.user.id,
    blackId: game.black?.user.id,
    whiteName: game.white?.user.name,
    blackName: game.black?.user.name,
    rated: game.rated,
  }
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Short, unambiguous id for shareable game URLs (~55 bits). */
function newGameId() {
  const bytes = randomBytes(10)
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")
}
