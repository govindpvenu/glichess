import {
  expect,
  test as base,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test"

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

/** 50 ms of silence as a WAV file, standing in for the sound files so tests don't need them. */
function silentWav() {
  const sampleRate = 8000
  const samples = sampleRate / 20
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write("RIFF", 0)
  wav.writeUInt32LE(36 + samples * 2, 4)
  wav.write("WAVEfmt ", 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20) // PCM
  wav.writeUInt16LE(1, 22) // mono
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write("data", 36)
  wav.writeUInt32LE(samples * 2, 40)
  return wav
}

const soundFile = silentWav()

export interface Players {
  white: Page
  black: Page
}

interface Options {
  viewport?: { width: number; height: number }
  /** Context options for Black only, e.g. a phone against a desktop White. */
  blackDevice?: BrowserContextOptions
  timeControl?: string
}

async function newPlayer(browser: Browser, options: Options, device?: BrowserContextOptions) {
  const context = await browser.newContext(
    device ?? (options.viewport ? { viewport: options.viewport } : {}),
  )
  await context.addInitScript(countSounds)
  await context.route("**/sounds/*.mp3", (route) =>
    route.fulfill({ body: soundFile, contentType: "audio/wav" }),
  )
  return context.newPage()
}

/** White creates an invite, Black opens the link; resolves once both see the game running. */
export async function startInviteGame(browser: Browser, options: Options = {}): Promise<Players> {
  const white = await newPlayer(browser, options)
  const black = await newPlayer(browser, options, options.blackDevice)

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
