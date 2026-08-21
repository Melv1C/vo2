# vo2

Endurance-training analytics for athletes, built around [Strava](https://www.strava.com). Sign in with Strava, sync your activities and streams, and visualize daily training load (CTL/ATL), power, TRIMP, pace, and swim metrics computed from a training-science metrics engine.

## Stack

|                            |                                                                   |
| -------------------------- | ----------------------------------------------------------------- |
| Monorepo                   | Turborepo + Bun workspaces                                        |
| Backend (`apps/backend`)   | Hono on Bun, Drizzle ORM + PostgreSQL, Better Auth (Strava OAuth) |
| Frontend (`apps/frontend`) | React 19 + Vite, TanStack Router/Query, Tailwind v4, recharts     |
| Shared UI (`packages/ui`)  | shadcn-style component library                                    |
| Tooling                    | TypeScript, oxlint/oxfmt, varlock, Changesets                     |

## Getting started

Prerequisites: [Bun](https://bun.sh) 1.3+, Docker.

```sh
# install dependencies
bun install

# generate env files
bun run env:generate

# start the dev database
bun run docker:db

# run database migrations
bun run --filter='backend' db:migrate

# start backend + frontend in dev mode
bun run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3000`.

A full production-like stack is available via `docker-compose.full.yml` (postgres + backend + nginx-served frontend).

## Scripts

| Command                                 | Description                 |
| --------------------------------------- | --------------------------- |
| `bun run dev`                           | Run all apps in dev mode    |
| `bun run build`                         | Build all workspaces        |
| `bun run check`                         | Format check + lint         |
| `bun run format`                        | Format with oxfmt           |
| `bun run docker:db`                     | Start/stop the dev Postgres |
| `bun run env:generate` / `env:validate` | Manage env vars via varlock |
| `bun run release:*`                     | Changesets release flow     |

## Deployment

- **CI**: lint/build on every push (`.github/workflows/ci.yml`)
- **Staging**: auto-deploys on every push to `main`
- **Production**: tag-triggered releases per app via Changesets tags
