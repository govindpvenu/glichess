import type { Page } from "@playwright/test"

import { expect, startInviteGame, test } from "./fixtures"

/** Width of the opponent's video as decoded, or 0 while no frames have arrived. */
const remoteVideoWidth = (page: Page) =>
  page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>(
      'video[aria-label$="\'s camera"]:not([aria-label="Your camera"])',
    )
    return video?.videoWidth ?? 0
  })

test("invite games start a video call both ways", async ({ browser }) => {
  const { white, black } = await startInviteGame(browser)

  for (const page of [white, black]) {
    const call = page.getByRole("region", { name: "Video call" })
    await expect(call.getByText("Connected")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel("Your camera")).toBeVisible()
    await expect.poll(() => remoteVideoWidth(page), { timeout: 20_000 }).toBeGreaterThan(0)
  }

  await test.step("turning the camera off reaches the opponent", async () => {
    await white.getByRole("button", { name: "Turn off camera" }).click()
    await expect(white.getByLabel("Your camera")).toBeHidden()
    await expect.poll(() => remoteVideoWidth(black)).toBe(0)
  })

  await test.step("muting the microphone shows on the other side", async () => {
    await black.getByRole("button", { name: "Turn off microphone" }).click()
    await expect(white.getByLabel("Opponent's microphone is off")).toBeVisible()
  })
})
