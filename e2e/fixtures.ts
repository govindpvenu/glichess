import { expect, test as base, type Browser, type Page } from "@playwright/test"

declare global {
  interface Window {
    soundsPlayed: number
  }
}

/** Counts the game sounds a page plays (decoded files started through Web Audio). */
const countSounds = () => {
  window.soundsPlayed = 0
  // oxlint-disable-next-line typescript/unbound-method -- called below with the right `this`
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...args) {
    window.soundsPlayed++
    return start.apply(this, args)
  }
}

export interface Players {
  white: Page
  black: Page
}

interface Options {
  viewport?: { width: number; height: number }
  timeControl?: string
}

async function newPlayer(browser: Browser, options: Options) {
  const context = await browser.newContext(options.viewport ? { viewport: options.viewport } : {})
  await context.addInitScript(countSounds)
  return context.newPage()
}

/** White creates an invite, Black opens the link; resolves once both see the game running. */
export async function startInviteGame(browser: Browser, options: Options = {}): Promise<Players> {
  const white = await newPlayer(browser, options)
  const black = await newPlayer(browser, options)

  await white.goto("/")
  await white.getByRole("button", { name: "Play a friend" }).click()
  const dialog = white.getByRole("dialog")
  await dialog.getByRole("button", { name: options.timeControl ?? "10+0", exact: true }).click()
  await dialog.getByRole("button", { name: "White", exact: true }).click()
  await dialog.getByRole("button", { name: "Create game" }).click()

  const link = await white.getByLabel("Invite link").inputValue()
  await black.goto(link)

  for (const page of [white, black]) {
    await expect(page.getByText(/your move|white to move/i).first()).toBeVisible()
  }
  return { white, black }
}

/** Plays a move by clicking the piece, then the target square. */
export async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click()
  await page.locator(`[data-square="${to}"]`).click()
}

export const soundCount = (page: Page) => page.evaluate(() => window.soundsPlayed)

export const test = base
export { expect }
