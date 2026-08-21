# Mobile Progress

Tracks status of **Phase 2 (mobile app)** against `docs/PLAN.md`'s roadmap.
Condensed from `docs/PROGRESS.md` (the backend/API build log, ~2100 lines of
PR-by-PR history) — only what the mobile client actually needs to know is
kept here. For anything else: full backend history is `docs/PROGRESS.md`,
current API surface is `docs/SERVICES.md`, architecture/data model is
`docs/PLAN.md`, domain terms are `docs/GLOSSARY.md`, plain-language feature
list is `docs/FUNCTIONALITIES.md`.

## Backend status (context, not our work)

Phase 1 (backend/API) is **functionally complete** — every Build Order step
(0–9) done, plus Production Readiness (CI pipeline, auth row cleanup, GDPR
export/delete, missing `User` FK retrofit) and GraphQL Code Generator on top.
515+ Jest tests, every feature branch reviewed (`pr-reviewer`) and audited
(`test-auditor`, `codebase-auditor`) before merge. No hosting/deployment yet
— local dev only.

## Facts mobile needs to know

- **Local API URL**: `http://localhost:4400` (not the `4000` default in
  `.env.example` — a port collision on the backend dev machine). From the
  **Android emulator**, use `http://10.0.2.2:4400` instead of `localhost`.
- **Auth is REST, everything else is GraphQL.** `/auth/request-otp`,
  `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`
  are plain REST routes (they issue the token GraphQL's context depends on).
  Everything else — categories, transactions, recurring expenses, month
  lifecycle, savings funds, bank balance — is one `POST/GET /graphql`
  endpoint. `GET /account/export` / `DELETE /account` are also REST
  (account-lifecycle, same category as `logout-all`).
- **Token lifecycle**: access JWT (15 min) + refresh token (30 days,
  DB-persisted, **mandatory rotation** on every refresh — a reused old
  refresh token fails). The app needs silent-refresh handling and secure
  refresh-token storage (e.g. `expo-secure-store`, not AsyncStorage).
- **Money is always integer cents** on the wire (`amountCents`, etc.) — the
  ×100/÷100 conversion happens only at the UI edge, per `CLAUDE.md`.
- **Dates are bare `YYYY-MM-DD` strings**, no time component — never send a
  full ISO timestamp for a date field. The one exception:
  `BankBalance.checkpointSetAt` is a full ISO 8601 timestamp (it anchors an
  instant, not a calendar day).
- **No normalized GraphQL cache** — per `CLAUDE.md`'s stack decision, mobile
  uses `graphql-request` + `@tanstack/react-query` with **manual
  invalidation on mutations**, not Apollo/urql-style cache normalization.
- **`BudgetMonth` has no `id` field** (deliberate backend design, see
  `PLAN.md`) — flagged during backend review as a frontend concern: a
  normalized cache couldn't auto-merge updates after `lockMonth`/
  `deleteBudgetMonth`. React Query's manual-invalidation approach sidesteps
  this, but worth remembering when wiring those two mutations (invalidate
  `currentMonth` + any month-scoped queries explicitly).
- **Query depth limit** (max 10) is always on; introspection lockdown is
  prod-only — irrelevant to normal client usage.
- **A real Excel reference exists**: `VISAO ANUAL 2026.xlsx` (the user's
  actual budget spreadsheet) was used to build the backend's dev seed
  script (`prisma/seed.ts` → `seed@example.com` account) — 15 sheets: one
  savings-fund tracker, one per calendar month (Jan–Dec), two
  grocery-breakdown sheets. Gitignored on the backend, never committed
  (real personal financial data) — not present in this repo. The seeded
  `seed@example.com` account (16 categories, 14 recurring bills, 2 income
  categories, English names) is a live, queryable proxy for real data shape
  if the Excel itself isn't available here. This is one of the two design
  references `CLAUDE.md` requires before mobile screen work begins — the
  other is the mockup screenshots.

## Phase 2 — Mobile app

**Status: scaffold done, no screens yet.** Per `docs/PLAN.md` /
`.claude/CLAUDE.md`: before any screen work, must interview for design
references (mockups + Excel structure) and grill layout/states/copy/colors/
edge-cases per screen — never assume or fill gaps with a "reasonable"
default.

- [x] Mockups reviewed — 24 screenshots in `mockups/` (budget home tabs,
      category/fund detail, the shared numeric-keypad entry UI, savings
      funds). Colors + typography extracted into
      `src/theme/design-tokens.json` (raw reference) and
      `src/theme/colors.ts` / `src/theme/typography.ts` /
      `src/theme/theme.ts` (typed runtime values, wired into
      `app/_layout.tsx` via `ThemeProvider`/`useTheme()`). Approximate by
      eye, not pixel-sampled — refine by hand if exact hex/font matters.
      **No auth/login mockup exists** (OTP login is a Phase-1 backend
      design choice, not part of the original Excel-based app design) —
      those screens will be designed conversationally, borrowing this
      palette — one exception is `colors.identity.badgeBackground`
      (`#FFCCDB`), a user-specified accent for the auth screens' logo/OTP
      box styling, not extracted from any mockup. **Dark mode has no
      design reference yet** —
      `theme.ts#resolveTheme` deliberately always returns the light theme
      for now (documented in code), not a real dark palette.
- [x] Excel structure (`VISAO ANUAL 2026.xlsx`) reviewed — added to the
      project root, gitignored (real personal financial data, same
      treatment as `mockups/`). 15 sheets: `Poupanças Tracker` (6 savings
      funds — Emergência/Casamento/Viajar/Reforma-ETF/Bazating/Casa, each
      with target/initial-balance/monthly tracking, matching
      `SavingsFund`), 12 monthly sheets Jan–Dec (recurring bills with
      name/amount/due-day; category budgets with a Preciso/Quero
      (Need/Want) type; a Salário section with named income sources;
      bank balance as `Saldo inicial`/`Saldo bancário agora`), 2
      supermarket-expense breakdown sheets. Confirmed, not new
      information — the category names (Compras/Comer Fora/Gasolina/
      Portagens/Saúde/etc.) match the mockups' English translations
      (Shopping/Eating Out/Gas/Tolls/Health) 1:1, and the whole structure
      matches the already-built backend data model exactly (this Excel is
      literally what the backend's seed script was built from).
- [x] Expo project scaffold (TypeScript, Expo Router, `graphql-request` +
      `@tanstack/react-query`, ESLint + Prettier, Jest + React Native
      Testing Library) — SDK 57, `npm`, bundle id
      `com.relense.budgettracker`. `app.config.ts` reads `API_URL` from
      `.env` (via `expo-constants`); `src/lib/apiUrl.ts` handles the
      Android-emulator `localhost` → `10.0.2.2` rewrite in dev.
- [x] Auth flow: two screens, `app/(auth)/login.tsx` (email entry) and
      `app/(auth)/verify.tsx` (6-box code entry, auto-submits at 6
      characters, 30s resend cooldown, distinct copy per backend error code
      — `incorrect_code`/`code_expired`/`too_many_attempts`/
      `code_not_found`). No mockup for these screens (see above) — copy is
      a first-pass draft, not user-confirmed pixel-for-pixel. REST client
      (`src/auth/authApi.ts`), `expo-secure-store` token storage
      (`src/auth/tokenStorage.ts`), a pure `authReducer` (tested) plus
      `AuthContext`/`useAuth` doing bootstrap-time silent refresh (mandatory
      rotation, so the stored refresh token is consumed and replaced on
      every app start). Routes are gated with Expo Router's
      `Stack.Protected` (`(app)` vs `(auth)` groups in root `_layout.tsx`),
      splash screen held via `expo-splash-screen` until the bootstrap
      refresh resolves. `deviceLabel` is omitted from `verifyOtp` calls for
      now (optional server-side; would need `expo-device`, a new dependency
      not yet asked for). 51 tests total across 11 suites (`authApi`,
      `authReducer`, `tokenStorage`, `AuthContext`, both auth screens, the
      root layout's route-gating, `Logo`/`SplashView` smoke tests) — went
      through three `pr-reviewer` rounds plus a `test-auditor` pass before
      merge; both found and fixed real bugs (see PR #5's commit history).
- [ ] First screen (real budget/category/transaction UI) — TBD

**Scaffold caveats worth knowing before the next `npm install` in this
repo** (SDK 57 is very new — pin these deliberately, don't let npm grab
latest):

- `jest` must stay on `^29.x` — `jest-expo@57.0.4` depends on
  `@jest/globals@^29.2.1` internally; `jest@30` breaks the mocker
  (`clearMocksOnScope` mismatch).
- `@react-native/jest-preset` must stay on `^0.86.2` (matching
  `react-native`'s own version) — a newer version's `setup-env.js` doesn't
  match this RN version's source layout.
- `.npmrc` sets `legacy-peer-deps=true` — `expo-router@57.0.15`'s bundled
  `@expo/ui` transitively pulls in several `@radix-ui/*` packages and
  `vaul` (web-only Tabs-picker components, unused on native), each of
  which declares `react-dom` as a **required** peer (`^16.8`..`^19.0.0-rc`
  range) — but this is a mobile-only project, so `react-dom` isn't
  installed anywhere in the tree to satisfy any of them. Verified directly
  against `package-lock.json`, not just the resolver's warning. Safe to
  remove once `expo-router`/`@expo/ui` mark that peer optional or stop
  bundling web-only deps into the native install.
- `test-renderer` (that exact package name, not `react-test-renderer`) is a
  **required** devDependency once component tests exist —
  `@testing-library/react-native@14` depends on it. React 19 deprecated
  `react-test-renderer`; `test-renderer` is its official modern
  replacement. `react-test-renderer` is still present too (pulled in
  elsewhere) but isn't what RNTL actually uses now.
- `@testing-library/react-native@14`'s `render()` and `fireEvent.*` are
  **async** and must be `await`ed — skipping `await` doesn't throw, it
  silently leaves the `screen` singleton unbound, so every later
  `screen.getByText`/etc. fails with "`render` function has not been
  called" (confirmed by bisecting down to a one-line repro before finding
  this — genuinely not obvious from the error message). Every test in
  `app/(auth)/*.test.tsx` awaits both.
- When mocking a module that exports custom `Error` subclasses (e.g.
  `src/auth/authApi.ts`'s `OtpRequestError`/`OtpVerifyError`), never use
  bare `jest.mock('module-path')` (auto-mock) — it replaces the class
  constructors with no-ops, so `new OtpRequestError('rate_limited')` in a
  test never actually sets `.code`, and `err.code === 'rate_limited'`
  checks in the real code silently fail. Use a factory that spreads
  `jest.requireActual(...)` and overrides only the specific functions
  (see `app/(auth)/login.test.tsx`/`verify.test.tsx`).
