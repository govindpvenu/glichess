import { anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** Talks to /api/auth on the current origin (proxied to Express in dev). */
export const authClient = createAuthClient({
  plugins: [anonymousClient()],
})
