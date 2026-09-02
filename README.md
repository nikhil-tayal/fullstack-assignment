# Assignment

Take-home assignment scaffold. Next.js front end, NestJS API, deployed to
[assignment.nikhiltayal.info](https://assignment.nikhiltayal.info).

Source: [github.com/nikhil-tayal/fullstack-assignment](https://github.com/nikhil-tayal/fullstack-assignment)

## Stack

| Part | Tech | Dev port |
|------|------|----------|
| `apps/web` | Next.js 15 (App Router), React 19, TypeScript, Tailwind | 3000 |
| `apps/api` | NestJS 11, TypeScript | 4001 |

pnpm workspaces tie the two together.

## Getting started

```bash
pnpm install
pnpm dev          # runs web + api in parallel
```

- Web: http://localhost:3000
- API: http://localhost:4001/api/health

The home page calls `/api/health` and renders the result, so a green dot means
the whole path — browser → Next → nginx → Nest — is wired up.

### Individual apps

```bash
pnpm web:dev
pnpm api:dev
```

### Build

```bash
pnpm build
```

`apps/web` builds to a standalone server (`.next/standalone`), so the droplet
runs it without installing front-end dependencies.

## Layout

```
apps/
  web/                 Next.js
    src/app/           routes (App Router)
    src/components/    React components
    src/lib/api.ts     API base URL helper
  api/                 NestJS
    src/main.ts        bootstrap — global /api prefix, binds 127.0.0.1
    src/app.module.ts  root module
    src/health/        health controller
```

## Deploy

See [DEPLOY.md](./DEPLOY.md). Short version: `./deploy.sh`.
