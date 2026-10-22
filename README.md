# glichess

Realtime chess with built-in video, voice and chat on one screen. Play as a guest or sign in with Google.

> Status: Phase 1 (identity). Visitors get a guest account automatically and can upgrade with Google.
> Gameplay, chat and video land in the next phases.

## Stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Web      | React 19, Vite, Tailwind CSS v4, shadcn/ui, React Router          |
| Server   | Express 5, Socket.IO, pino                                        |
| Data     | Neon Postgres, Drizzle ORM, Redis (Upstash)                       |
| Realtime | Socket.IO for game state and signaling, WebRTC for media          |
| Chess    | chess.js (server-authoritative validation), react-chessboard      |
| Auth     | Better Auth (anonymous guests + Google)                           |
| Tooling  | pnpm workspaces, TypeScript 7, Oxlint (type-aware), Oxfmt, Docker |

## Layout

```
apps/
  web/        React SPA
  server/     Express + Socket.IO; serves the built SPA in production
packages/
  shared/     Socket event contracts and shared constants (TypeScript source, bundled by consumers)
  db/         Drizzle schema, migrations and client factory
```

The web app and API share one origin in every environment. In development Vite proxies `/api` and
`/socket.io` to the server; in production Express serves the built SPA. This keeps auth cookies
first-party without CORS configuration.

## Getting started

Requires Node 22.22+ and Corepack (ships with Node).

```sh
corepack enable          # uses the pnpm version pinned in package.json
pnpm install
cp .env.example .env
pnpm dev                 # web on http://localhost:5173, server on :3000
```

## Authentication

Better Auth runs inside the Express server and stores users and sessions in Neon via Drizzle.

- Every visitor is signed in as a guest on first load (Better Auth's anonymous plugin), with a
  generated name such as `SwiftRook482`.
- "Sign in with Google" links the guest to a Google account. The `onLinkAccount` hook
  (`apps/server/src/auth/link-guest.ts`) is where guest-owned data moves to the account before
  the guest user is deleted.
- Socket.IO connections are authenticated from the same session cookie during the handshake;
  connections without a session are rejected.

## Environment

| Variable                                    | Purpose                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                              | Neon pooled connection string (runtime)                               |
| `DATABASE_URL_DIRECT`                       | Neon direct connection string (migrations)                            |
| `BETTER_AUTH_URL`                           | Public origin of the app (`http://localhost:5173` in dev)             |
| `BETTER_AUTH_SECRET`                        | Session signing secret (`openssl rand -base64 32`)                    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client; redirect URI `<origin>/api/auth/callback/google` |
| `RUN_MIGRATIONS`                            | Apply migrations on boot (defaults to `true` in production)           |

## Scripts

| Command                           | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                        | Run web and server with hot reload                          |
| `pnpm build`                      | Build every package                                         |
| `pnpm start`                      | Run the built server (serves the web build)                 |
| `pnpm lint` / `pnpm typecheck`    | Static checks                                               |
| `pnpm format`                     | Format with Oxfmt (also sorts imports and Tailwind classes) |
| `pnpm db:generate` / `db:migrate` | Create and apply Drizzle migrations                         |

## Deployment

The `Dockerfile` builds a single image containing the server and the static web build. `render.yaml`
deploys it to Render's free tier. Neon, Upstash and Cloudflare TURN all have free tiers that cover a
demo deployment.

```sh
docker build -t glichess .
docker run -p 3000:3000 --env-file .env -e NODE_ENV=production glichess
```

## Notes

- After `pnpm dlx shadcn add <component>` in `apps/web`, check the generated `cn` import points to
  `@/lib/utils`. The CLI can misresolve the alias in this workspace layout.
