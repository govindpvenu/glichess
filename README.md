# glichess

Realtime chess with built-in video, voice and chat on one screen. Play as a guest or sign in with Google.

> Status: Phase 0 (foundation). Gameplay, auth, chat and video land in the next phases.

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
