import { expect, startInviteGame, test } from "./fixtures"

// A small Android phone; most phones are wider.
const phone = { width: 360, height: 780 }

test("phones get the call above the board and tabs for moves and chat", async ({ browser }) => {
  const { white, black } = await startInviteGame(browser, { viewport: phone })

  for (const page of [white, black]) {
    const call = await page.getByRole("region", { name: "Video call" }).boundingBox()
    const board = await page.locator('[data-square="a1"]').boundingBox()
    expect(call && board && call.y < board.y).toBe(true)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  }

  await test.step("a message on the hidden chat tab shows an unread badge", async () => {
    const chatTab = black.getByRole("tab", { name: /^Chat/ })
    await expect(black.getByRole("tab", { name: "Moves" })).toHaveAttribute("aria-selected", "true")

    await white.getByRole("tab", { name: /^Chat/ }).click()
    await white.getByRole("button", { name: "Hi!" }).click()
    await white.getByRole("button", { name: "Have fun" }).click()
    await expect(chatTab.getByLabel("2 unread")).toBeVisible()

    await chatTab.click()
    await expect(black.getByLabel("Chat messages").getByText("Have fun")).toBeVisible()
    await expect(chatTab.getByLabel(/unread/)).toBeHidden()
  })
})
