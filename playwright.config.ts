import { defineConfig, devices } from "@playwright/test"

const ci = !!process.env.CI

export default defineConfig({
  testDir: "e2e",
  // Every test plays its own game against the shared dev server and database.
  fullyParallel: true,
  workers: ci ? 2 : 4,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: ci,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    permissions: ["camera", "microphone"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // A test pattern and a beep stand in for the camera and microphone.
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @glichess/server dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @glichess/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
  ],
})
