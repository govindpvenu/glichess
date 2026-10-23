import { devices, type Page } from "@playwright/test"

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

/** The video's own size and the size of the box it is shown in. */
const videoShape = (page: Page, selector: string) =>
  page.locator(selector).evaluate((video: HTMLVideoElement) => {
    const box = video.getBoundingClientRect()
    return { portrait: video.videoHeight > video.videoWidth, tall: box.height > box.width }
  })

test("an upright phone sends portrait video, shown upright on both sides", async ({ browser }) => {
  const { white: desktop, black: phone } = await startInviteGame(browser, {
    blackDevice: { ...devices["Pixel 7"], permissions: ["camera", "microphone"] },
  })
  const remote = 'video[aria-label$="\'s camera"]:not([aria-label="Your camera"])'

  await expect.poll(() => remoteVideoWidth(desktop), { timeout: 20_000 }).toBeGreaterThan(0)
  // The phone's own preview and the desktop's view of the phone are both portrait.
  await expect
    .poll(() => videoShape(phone, 'video[aria-label="Your camera"]'))
    .toEqual({
      portrait: true,
      tall: true,
    })
  await expect.poll(() => videoShape(desktop, remote)).toEqual({ portrait: true, tall: true })
})
