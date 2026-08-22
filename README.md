# Budget Tracker — Mobile App

The mobile client (Expo / React Native) for a budget & savings tracker, built API-first — a portfolio project designed for real, multi-user, production use rather than a local single-device app.

This repo is **Phase 2** of the project: the mobile app that consumes an already-built GraphQL + REST API (Phase 1, backend — separate repo). Phase 3 (website) will be a later, thin client on the same API.

## Status

Auth flow (email OTP), Budget Home, Add/Edit Category, and Add/Edit Transaction screens are built and wired to the live API, including session token refresh (reactive + proactive) and screen-specific retryable error states. See `docs/PROGRESS-MOBILE.md` for the full build log. Every screen still goes through a design interview (mockups + the source Excel budget structure) before work starts, rather than guessing layout/copy/behavior from assumptions.

## Stack

- [Expo](https://expo.dev/) (React Native) + TypeScript
- Expo Router (file-based navigation)
- `graphql-request` + [`@tanstack/react-query`](https://tanstack.com/query) for data fetching/caching — manual cache invalidation on mutations, no normalized GraphQL cache
- Jest + React Native Testing Library

## Docs

| File | What it's for |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Architecture, full data model, GraphQL schema, business rules |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | Domain terminology — used exactly in code |
| [`docs/SERVICES.md`](docs/SERVICES.md) | Current API surface at a glance (GraphQL schema + REST routes) |
| [`docs/FUNCTIONALITIES.md`](docs/FUNCTIONALITIES.md) | Plain-language walkthrough of what the app can do |
| [`docs/PROGRESS-MOBILE.md`](docs/PROGRESS-MOBILE.md) | Mobile build status + API facts the client needs day-to-day |

`.claude/CLAUDE.md` carries the standing rules for working on this project with Claude Code (TDD, multi-tenancy, money-as-cents, no invented details, etc.) — read automatically every session.

## API

The backend (Phase 1) is functionally complete and lives in a separate repository. Local dev API: `http://localhost:4400` (`http://10.0.2.2:4400` from the Android emulator). Auth (`/auth/*`) and account lifecycle (`/account/*`) are REST; everything else is one GraphQL endpoint at `/graphql`. See `docs/SERVICES.md` for the full surface.

## Getting started

```
npm install
cp .env.example .env   # adjust API_URL if your backend isn't on the default port
npm start              # then press i / a / w, or scan the QR code in Expo Go
```

Other scripts: `npm test` (Jest), `npm run lint` (ESLint), `npm run typecheck` (tsc), `npm run format` (Prettier).
