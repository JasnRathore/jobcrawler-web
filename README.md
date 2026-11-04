# Crawler frontend

The web app is an independent Next.js project. It uses the App Router, Tailwind
CSS v4, shadcn/ui, Opaline glass components, and the Turso serverless TypeScript
SDK for direct remote database access.

## Setup

From this directory, install dependencies and create a local environment file:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local` using your
Turso database credentials. To use the crawler's remote database, use the same
URL and token values configured for the Go project. The Next.js app connects
directly to Turso; it does not call the Go app or read its local SQLite file.
Do not prefix these values with `NEXT_PUBLIC_`: the token must remain
server-side. Environment files are git-ignored.

Start the development server:

```powershell
npm run dev
```

## Turso

`lib/turso.ts` exports `getTursoConnection()` for server components, route
handlers, and server actions. It lazily creates a serverless Turso connection
using the two environment variables above and reports a clear error if either
is missing. Never import it from a client component.

## Browse jobs

The home page is a standalone job browser backed directly by the shared Turso
database. It searches jobs across all supported providers and includes keyword,
location, provider, employment, workplace, and posting-date filters; optional
description search; saved jobs; and paging. The API routes in `app/api` query
`indexed_jobs` and `indexed_bookmarks` directly without going through the Go
project or changing the crawler's database schema.

Saved jobs use the shared `indexed_bookmarks` table, so they are global to this
database (there are no user accounts or per-user bookmarks yet). Protect the
deployment appropriately if it should not be public.

## UI

Initialize shadcn components with:

```powershell
npx shadcn@latest add button
```

Add Opaline components from the shadcn registry as needed:

```powershell
npx shadcn@latest add @opaline/theme @opaline/glass-button
```

The Opaline glass provider is configured in `app/layout.tsx`; the generated
components are under `components/ui/opaline`. True refraction requires Chromium;
other browsers use the component's frosted-glass fallback.

## Checks

```powershell
npm run lint
npm run build
```
