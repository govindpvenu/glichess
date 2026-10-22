import { schema } from "@glichess/db"
import type { PublicUser } from "@glichess/shared"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { anonymous } from "better-auth/plugins/anonymous"

import { db } from "../db"
import { env } from "../env"
import { generateGuestName } from "./guest-name"
import { transferGuestData } from "./link-guest"

export const auth = betterAuth({
  appName: "glichess",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Signed session cookie lets most getSession calls (including socket handshakes) skip the database.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    anonymous({
      generateName: generateGuestName,
      onLinkAccount: ({ anonymousUser, newUser }) =>
        transferGuestData({
          guestId: anonymousUser.user.id,
          account: {
            id: newUser.user.id,
            name: newUser.user.name,
            image: newUser.user.image ?? null,
            isGuest: false,
          },
        }),
    }),
  ],
})

export type AuthSession = typeof auth.$Infer.Session

export function toPublicUser(user: AuthSession["user"]): PublicUser {
  return {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
    isGuest: user.isAnonymous ?? false,
  }
}
