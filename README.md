# Crawler frontend

The web app is an independent Next.js project. It uses the App Router, Tailwind
CSS v4, shadcn/ui, and the Turso serverless TypeScript SDK for direct remote
database access.

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
description search; saved jobs; and paging. The API route in `app/api/jobs`
queries `indexed_jobs` directly without going through the Go project or changing
the crawler's database schema. The route checks Fetch Metadata and Origin or
Referer headers to reject cross-origin browser requests. This is a browser
boundary, not authentication: direct HTTP clients can forge these headers, so
the public jobs endpoint is not protected from determined scrapers.

Saved jobs are stored in the browser's local storage and are available only in
the browser profile where they were saved. They are not synchronized across
devices or browser profiles and are not confidential. Existing rows in the
shared `indexed_bookmarks` table are not imported.

## UI

The Crawler job browser brings five hiring platforms into one searchable index.
Search stays prominent, filters sit beside results on larger screens and
collapse behind a filter control on small screens, and Explore/Saved are the
primary navigation. The warm paper-and-forest palette is shared by light and
dark themes through the tokens in `app/globals.css`; the theme follows the
system setting by default and the header toggle remembers an explicit choice on
this device. Search, filtering, pagination, and apply links use the live jobs
route; bookmark changes are stored in local storage.

The mobile web experience is specified in
[`docs/ui/mobile/final-mobile-ui-spec.md`](docs/ui/mobile/final-mobile-ui-spec.md),
with supporting [design](docs/ui/mobile/design-brief.md) and
[interaction](docs/ui/mobile/interaction-spec.md) documents. The responsive
navigation and draft/apply filter sheet are implemented in
`components/job-browser.tsx`; the final specification remains under council
review.

## AI

The frontend does not currently make model calls or include an AI execution
workflow. Job discovery is backed by the existing Turso routes, while saved
roles are stored locally in the browser; the UI does not simulate AI-generated
results. GitHub Copilot can be used to develop the application, but adding an
in-product AI feature requires a concrete capability and a server-side model
integration.

## Checks

```powershell
npm run lint
npm run build
```
