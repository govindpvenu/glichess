import { expect, move, soundCount, startInviteGame, test } from "./fixtures"

test("two players play, chat, finish and rematch a game", async ({ browser }) => {
  const { white, black } = await startInviteGame(browser)
  const whiteChat = white.getByLabel("Chat messages")
  const blackChat = black.getByLabel("Chat messages")

  // White was waiting, so they hear and read that the game started.
  await expect(whiteChat.getByText("Game started")).toBeVisible()
  await expect.poll(() => soundCount(white)).toBe(1)
  expect(await soundCount(black)).toBe(0)

  await test.step("moves reach the other player, with a sound on both sides", async () => {
    await move(white, "e2", "e4")
    await expect(black.getByLabel("Move list")).toContainText("e4")
    await move(black, "e7", "e5")
    await expect(white.getByLabel("Move list")).toContainText("e5")
    await expect.poll(() => soundCount(white)).toBe(3)
    await expect.poll(() => soundCount(black)).toBe(2)
  })

  await test.step("chat goes both ways", async () => {
    await black.getByRole("button", { name: "Good luck" }).click()
    await expect(whiteChat.getByText("Good luck")).toBeVisible()
    await white.getByLabel("Message", { exact: true }).fill("You too")
    await white.getByLabel("Message", { exact: true }).press("Enter")
    await expect(blackChat.getByText("You too")).toBeVisible()
  })

  await test.step("muting hides the opponent's messages until unmuted", async () => {
    await white.getByRole("button", { name: /^Mute / }).click()
    await expect(whiteChat.getByText("Good luck")).toBeHidden()
    await expect(white.getByText(/is muted$/)).toBeVisible()

    await black.getByLabel("Message", { exact: true }).fill("Can you read this?")
    await black.getByLabel("Message", { exact: true }).press("Enter")
    await expect(blackChat.getByText("Can you read this?")).toBeVisible()
    await expect(whiteChat.getByText("Can you read this?")).toBeHidden()

    await white.getByRole("button", { name: /^Unmute / }).click()
    await expect(whiteChat.getByText("Can you read this?")).toBeVisible()
  })

  await test.step("the chat notes when the opponent leaves and comes back", async () => {
    await expect(whiteChat.getByText(/is back$/)).toHaveCount(0)
    await black.reload()
    await expect(whiteChat.getByText(/ left$/)).toBeVisible()
    await expect(whiteChat.getByText(/is back$/)).toBeVisible()
  })

  await test.step("draw offers show up in the chat", async () => {
    await white.getByRole("button", { name: "Offer draw" }).click()
    await expect(blackChat.getByText(/offers a draw$/)).toBeVisible()
    await black.getByRole("button", { name: "Decline" }).click()
    await expect(whiteChat.getByText("Draw offer declined")).toBeVisible()
  })

  await test.step("resigning ends the game for both", async () => {
    await white.getByRole("button", { name: "Resign" }).click()
    await white.getByRole("button", { name: "Confirm" }).click()
    for (const chat of [whiteChat, blackChat]) {
      await expect(chat.getByText("Black wins · 0–1 · by resignation")).toBeVisible()
    }
  })

  await test.step("a rematch swaps colours", async () => {
    const finished = white.url()
    await white.getByRole("button", { name: "Rematch" }).click()
    await expect(blackChat.getByText(/wants a rematch$/)).toBeVisible()
    await black.getByRole("button", { name: "Accept rematch" }).click()

    for (const page of [white, black]) await expect(page).not.toHaveURL(finished)
    expect(black.url()).toBe(white.url())
    await expect(black.getByText("Your move")).toBeVisible()
  })
})

test("quick pair matches two players", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage()
  const second = await (await browser.newContext()).newPage()
  for (const page of [first, second]) {
    await page.goto("/")
    await page.getByRole("button", { name: /^15\+10/ }).click()
  }
  for (const page of [first, second]) await expect(page).toHaveURL(/\/game\//)
  expect(second.url()).toBe(first.url())
})

test("leaving a game shows a way back in the header", async ({ browser }) => {
  const { white, black } = await startInviteGame(browser)
  const back = white.getByRole("link", { name: /^Game in progress against / })
  await expect(back).toBeHidden()

  // Leave through the app's own navigation, as a player would.
  await white.getByRole("link", { name: "Play", exact: true }).click()
  await expect(white).toHaveURL(/\/$/)
  // Being away starts the abandonment countdown, shown on the link.
  await expect(back).toContainText(/Back to game · \d+s/)
  await expect(black.getByRole("link", { name: /^Game in progress/ })).toBeHidden()

  await back.click()
  await expect(white).toHaveURL(/\/game\//)
  await expect(back).toBeHidden()

  // The link goes away once the game ends, even while the player is elsewhere.
  await white.getByRole("link", { name: "Play", exact: true }).click()
  await expect(back).toBeVisible()
  await black.getByRole("button", { name: "Abort" }).click()
  await expect(back).toBeHidden()
})
