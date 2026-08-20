# Budget Tracker — Mobile App

The mobile client (Expo / React Native) for a budget & savings tracker, built API-first — a portfolio project designed for real, multi-user, production use rather than a local single-device app.

This repo is **Phase 2** of the project: the mobile app that consumes an already-built GraphQL + REST API (Phase 1, backend — separate repo). Phase 3 (website) will be a later, thin client on the same API.

## Status

Not started yet. Currently just project docs and Claude Code configuration — no app code. Before any screen work begins, this project requires a design interview (mockups + the source Excel budget structure) rather than guessing layout/copy/behavior from assumptions.

## Stack (planned)

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

Not yet available — project scaffold hasn't been created.
