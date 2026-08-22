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

**Status: scaffold, auth flow, Budget Home, Add/Edit Category,
Add/Edit Transaction, and Add/Edit Recurring Expense + Income screens
done.** Per `docs/PLAN.md` /
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
- [x] Budget Home screen (`app/(app)/index.tsx`) — the four-tab
      Available/Expenses/Recurrent/Income dashboard. No dedicated
      dashboard-aggregate GraphQL fields exist server-side; all header
      totals are computed client-side (`src/lib/budgetHomeCalculations.ts`)
      from data the tabs already fetch. The four tabs are **not** views
      over one shared query — confirmed against the real schema: Available
      and Income both use `categoryMonths` (filtered by `direction`),
      Expenses uses `transactions` (filtered client-side to
      `direction === 'EXPENSE'`), Recurrent uses `recurringExpenses`. Header
      shows one of 5 metrics at a time (Available Budgeted / Total Expenses
      / Total Recurrent / Total Income / Total Balance), switchable via a
      tap-to-open dropdown. Month picker is deferred — the month label is
      static text for now. Row taps and the 3 "+ New ..." add-rows
      (Available/Recurrent/Income; Expenses has none, by design) are all
      inert stubs — no create/detail flows built yet. Icons use
      `@expo/vector-icons/MaterialCommunityIcons` behind a semantic-name
      mapping layer (`src/components/CategoryIcon.tsx`) — `Category.icon`
      from the backend (e.g. `"cart"`) is deliberately library-agnostic;
      the mapping to a specific icon library's name lives in exactly one
      place so the library can be swapped later without touching call
      sites. Category circle backgrounds use `category.color` directly and
      icon glyphs render plain black — **superseded from the original
      `${category.color}33` opacity-tint design** once the Add Category
      screen (below) introduced a fixed icon→color palette; see that
      bullet for why. Bottom nav is drawn for visual completeness but only
      the profile icon is wired (to `signOut()`, as a temporary stand-in
      until a real profile screen exists — see code comment).
- [x] Add Category screen (`app/(app)/add-category.tsx`) — modal reached
      from the Home screen's "New budget category" row. First choice (only
      shown if the catalog has a category not yet active this month, via
      `filterUnusedExpenseCategories`): "Select Category" vs. "Create
      Category" buttons in place of the name/icon row; picking existing opens
      a scrollable catalog list (`ExistingCategoryPicker`) and only the
      budget amount stays enterable (name/icon/budget-type become
      read-only, calling `addCategoryToMonth` only — no `createCategory`);
      picking new reveals the full form (icon picker, name, Need/Want/
      Savings, calls `createCategoryWithBudget`). A back arrow returns to
      the choice from either path. Duplicate category names are blocked
      client-side with a toast (`Toast.tsx`, pastel-red, no library).
      Shares `AmountKeypad` (added this pass, `src/components/
      AmountKeypad.tsx` — flex-sized; a calendar/date-toggle key was added
      later, opt-in via `onToggleDateMode`, see the Add/Edit Transaction
      bullet below) and Fredoka (loaded app-wide in `app/_layout.tsx`
      via `@expo-google-fonts/fredoka`; every `typography.scale` entry sets
      only `fontFamily`, never `fontWeight` alongside it — setting both
      made iOS synthesize extra bold on an already-bold static font file).
      **Icon colors are a fixed, hand-supplied 16-entry palette**
      (`src/lib/categoryIconPalette.ts`'s `EXPENSE_ICON_PALETTE`), one
      distinct hex per icon, deliberately **not** the category's own
      stored `color` (which can be an old/inconsistent value) — every
      render on this screen and in `ExistingCategoryPicker` derives color
      from the icon via `colorForIcon()`, and icon glyphs are always plain
      black rather than tinted. This is why Budget Home's row rendering
      (above) changed to match. **The backend doesn't know about this
      palette yet** — the exact icon→color JSON below was handed to a
      separate agent to update `defaultCategories.ts`/`prisma/seed.ts` so
      the DB's stored `color` agrees; once that lands, this file's
      client-side override could in principle be removed, but there's no
      requirement to do so (deriving from the icon is also just simpler
      than trusting a stored value to stay in sync):
      ```json
      {
        "cart": "#CEF3C8", "utensils": "#F3D9C8", "fuel": "#F3E8C8",
        "road": "#C8D3F3", "heart": "#F3C8C8", "star": "#EEF3C8",
        "book": "#C8E3F3", "shirt": "#DEC8F3", "coffee": "#F3C8D9",
        "gift": "#EEC8F3", "moon": "#CEC8F3", "plus-circle": "#C8F3D3",
        "cpu": "#C8F3F3", "file-text": "#C8F3E3", "car": "#DEF3C8",
        "gamepad": "#F3C8E9"
      }
      ```
      145 tests total across 25 suites.
- [x] Edit Category screen (`app/(app)/edit-category.tsx`) + swipe-to-edit —
      Available-tab rows are now wrapped in `SwipeableRow`
      (`src/components/SwipeableRow.tsx`, a swipe-left-to-reveal-Edit
      `react-native-gesture-handler` row; the action pane translates in
      step with the drag rather than being statically uncovered). A row is
      deliberately left open (not explicitly closed) on Edit press — the
      edit screen covers it, and the caller resets it via a focus-triggered
      remount (`listResetKey` bumped on `navigation.addListener('focus', …)`,
      folded into each row's `key`) once the user comes back, since an
      animated `close()` either direction was visibly racing the screen
      transition. Edit screen itself: rename/rebudget/delete, mirroring Add
      Category's identity-row + keypad layout, `useUpdateCategory`/
      `useUpdateCategoryMonthBudget`/`useRemoveCategoryFromMonth`
      (`src/api/categoryMutations.ts`) — delete cascades to removing the
      catalog `Category` too if this was its last active month anywhere
      (see `SERVICES.md`).
- [x] Add/Edit Transaction screens (`app/(app)/add-transaction.tsx`,
      `app/(app)/edit-transaction.tsx`) — the bottom-nav `+` (previously
      inert) opens Add Transaction: a category pill (defaults to the first
      active expense category this month, tap to switch via the same
      `ExistingCategoryPicker` overlay pattern as Add Category), amount
      keypad, optional merchant/description field, confirm. Expenses-tab
      rows get the same swipe-to-edit treatment as above, opening Edit
      Transaction (amount/category/date/merchant all editable, plus
      Delete). `src/api/transactionMutations.ts` adds
      `createTransaction`/`updateTransaction`/`deleteTransaction` +
      hooks, all invalidating `transactions`/`categoryMonths`/`bankBalance`
      together (a transaction changes all three). **Date entry is
      day-only, not a full date picker**: a transaction's `categoryMonthId`
      is always scoped to the current unlocked month (every earlier month
      is locked), so typing a different month/year would never be valid —
      the keypad's calendar key (`AmountKeypad`'s new opt-in
      `onToggleDateMode`/`dateMode` props, unused by Add/Edit Category)
      only lets you type 1-2 day digits, with month/year fixed and shown
      for context (e.g. "21 Sep 2026"); `src/lib/dateInput.ts` rejects a
      second digit that would exceed that specific month's real day count
      (Feb/leap years included), so an invalid day can't structurally be
      typed at all — no "invalid date" error state exists. Bug fix that
      came out of this pass: the Expenses tab's per-row percent was
      `thisTransaction ÷ budget` instead of the category's cumulative
      `actualAmountCents ÷ budget` (only visibly wrong once a category has
      more than one transaction) — `TRANSACTIONS_QUERY` now also fetches
      `categoryMonth.actualAmountCents`. 245 tests total across 32 suites.
- [x] Retryable, screen-specific error states (`src/components/RetryableError.tsx`)
      — replaces the one shared "Something went wrong loading this. Please
      try again." text that previously blanked out an entire screen (no
      retry, and on Budget Home no way to navigate away at all — not even
      sign out) on any query failure. Each screen/query now has its own
      distinct, greppable message (e.g. "Couldn't load your transactions."
      vs "Couldn't load your budget categories.") plus a "Try again" button
      that calls that query's `refetch()`. Budget Home
      (`app/(app)/index.tsx`) keeps its header/tabs/bottom-nav shell up at
      all times now — only the list area shows the spinner/error, scoped to
      whichever query (current month vs. the active tab's own query)
      actually failed. Add/Edit Transaction and Add Category keep the modal
      grabber visible and add a retry button where there previously was
      none. 249 tests total across 33 suites.
- [x] Session token refresh (`src/auth/AuthContext.tsx`) — root-caused the
      generic errors above to a real gap, not a UI-only problem: the access
      JWT is short-lived (15 min, see `docs/PLAN.md`) and nothing refreshed
      it except once, at cold-start bootstrap, so any session left open past
      15 minutes started failing every request with `UNAUTHENTICATED` until
      the app was killed and reopened. Two mechanisms now, neither alone
      being enough (a reactive-only fix eats a failed round-trip on every
      idle-then-resume; a proactive-only fix misses a token that expires
      while the app stays continuously foregrounded):
      - **Reactive** — `useAuth()` exposes `requestWithAuth(request)`, which
        every query/mutation hook now goes through instead of reading
        `accessToken` and calling the API directly (an interface change,
        flagged before starting: touches `AuthContext`'s return shape and
        all ~14 call sites across `budgetHomeQueries.ts`,
        `categoryQueries.ts`, `categoryMutations.ts`,
        `transactionMutations.ts`). On `isUnauthenticatedError` (new export
        from `graphqlClient.ts`, checking `extensions.code ===
        'UNAUTHENTICATED'` per `docs/SERVICES.md`), refreshes and retries
        the same request exactly once with the new token; any other error
        (network, validation, a second UNAUTHENTICATED after the retry)
        passes straight through unchanged.
      - **Proactive** — an `AppState` listener refreshes on transition to
        `active` if the current token is ≥10 min old (comfortably under the
        real 15-min TTL), so by the time you switch back into the app after
        being away, the token's usually already fresh — this is the case
        the user actually hit ("go idle, switch to another app, come back,
        can't use it").
      - Both funnel through one **single-flighted** `refreshAccessToken`
        (a `useRef`-held in-flight promise) — the backend's refresh token is
        single-use with mandatory rotation, so if several requests fail at
        once (Budget Home fires ~5 in parallel), only the first may actually
        call `refreshSession`; the rest await that same promise instead of
        each trying to rotate it independently, which would make every one
        but the first fail. A failed refresh (revoked/expired/already-used
        refresh token) signs out, same as a rejected refresh at bootstrap.
      - Does **not** weaken the "stolen access token is only useful for 15
        min" property: refreshing still strictly requires the refresh
        token, a separate secret the resolver verifying the access token
        never sees. The device already held the refresh token continuously
        in SecureStore since sign-in (that's what "stay signed in" already
        meant); this only changes *when* the legitimate app uses a secret it
        already had, not what an attacker could get from either token
        leaking on its own.
      - `AuthState`/`AuthAction` (`src/auth/authReducer.ts`) gained
        `accessTokenIssuedAt` and a `TOKEN_REFRESHED` action, distinct from
        `SIGN_IN` (a mid-session rotation, not a fresh login) — an interface
        change to the reducer's state shape, flagged for the same reason as
        above. Round-2/3 pr-reviewer fix: a refresh in flight had no
        awareness of a concurrent `signOut()` -- if the user signed out
        while a proactive (foreground-resume) or reactive refresh was still
        pending, the late-arriving refresh would re-persist a fresh token
        pair to SecureStore and dispatch back to `signedIn`, silently
        resurrecting a session the user had just explicitly ended. A first
        pass (a `sessionGenerationRef` checked once, right after
        `refreshSession` resolves) turned out to only narrow the window,
        not close it — a sign-out landing during the *next* await
        (`setStoredTokens`'s own SecureStore write) still slipped through,
        since nothing re-checked the generation after that point. Actually
        fixed by making `signOut()` itself `await` any in-flight
        `refreshPromiseRef.current` before doing its own clear/dispatch --
        this makes the final state deterministic by ordering (`signOut()`'s
        `SIGN_OUT` dispatch is always the last word, whichever await the
        stale refresh happened to be suspended on) rather than depending on
        a check happening to sit at the right point in the code. The
        generation check stays too, re-verified at both await boundaries,
        as defense in depth on top of that ordering guarantee. Two tests
        cover the two distinct interleavings (sign-out during the refresh's
        network call vs. during its token persist). The second one's first
        draft asserted only the final `status`/`accessToken` values and
        turned out to pass even against fully unfixed code -- not because
        the race was closed, but because React batches the
        `TOKEN_REFRESHED` + `SIGN_OUT` dispatches from the same event into
        one render, so the transient bad intermediate state a real bug
        produces is never actually committed/observable that way, and
        `signOut()`'s dispatch landing last in the final render can pass
        by coincidence of which side's remaining awaits happen to resolve
        first. Reworked to assert directly on `requestWithAuth`'s retry
        call (a plain function call, not React state, so it isn't subject
        to that batching) — confirmed by checking out the pre-fix
        `AuthContext.tsx` in isolation and rerunning both tests against it
        before restoring the fix. 265 tests total across 33 suites.
- [x] Available/Expenses row layout + copy tweaks — the Available tab's
      category row now shows amount *spent so far* as the headline figure
      (was the remaining-available amount) with the category's total
      budget in gray underneath (was the percent-spent); the Expenses
      tab's transaction rows dropped the percent-spent text entirely,
      showing only the transaction's own amount. `ListRow`'s now-unused
      `percentText` prop was removed rather than left dead (nothing renders
      it anywhere after this). Copy: "New budget category" → "New
      Category" (Available tab's add row); Add Category's "Total budget"
      label → "Total category budget" (Edit Category's own "Total budget"
      label was left as-is — only Add Category was asked for). Follow-up in
      the same pass: an Available row whose `actualAmountCents` exceeds its
      `monthlyBudgetCents` showed "Overspent" instead of "Available" as its
      left-side subtitle, in the same red (`colors.button.deleteBackground`)
      already used for delete/error text elsewhere — reverted immediately
      after (see below), so this never shipped past this same PR. 267 tests
      total across 33 suites.
- [x] Reverted the "Overspent"/red-subtitle state above before it ever
      merged — decided the spent (headline) vs. budget (gray, secondary)
      figures already make an over-budget category obvious at a glance, no
      separate state needed. The Available row's left-side subtitle is now
      just the static label "Budget" (was "Available"/"Overspent"
      depending on state); `ListRow`'s `subtitleColor` prop was removed
      again along with it, since nothing else used it.
- [x] Add Transaction defaults the category pill to whatever category the
      most recently *dated* transaction used this month, instead of always
      the first active expense category — `app/(app)/add-transaction.tsx`
      now also calls `useTransactions(month)` and reads
      `[0].categoryMonth.id` as the default, falling back to first-in-list
      if that category is no longer active this month or no transactions
      exist yet. `transactions(month)` is ordered `date DESC, createdAt
      DESC` server-side (`docs/SERVICES.md`) — **date is the primary sort
      key, createdAt only breaks ties within the same date** — so `[0]` is
      the transaction dated latest, not necessarily the one entered most
      recently; a backdated entry (logging a purchase from a few days ago)
      won't become the default even though it was just created. The API
      doesn't expose `createdAt` to this client at all, so true
      creation-order isn't available — this is the closest approximation
      the schema allows, and matches the common case (transactions logged
      close to when they happened). An explicit user pick (via the category
      picker) still always wins over this default. Loading: `transactionsQuery`
      was added to the screen's loading/error gating to avoid a flash of
      the wrong default once it resolves -- a no-op in the common case
      (navigating from Budget Home, which already warmed the same
      `['transactions', month]` cache), but a real added wait in a cold-start
      path that skips Home (e.g. a very fast tap before Home's own fetch
      lands). 270 tests total across 33 suites.
- [x] `test-auditor` + `codebase-auditor` pass, and fixes for both.
      **test-auditor**: verdict "tests trustworthy," one real gap — none of
      the ~14 query/mutation hooks (`budgetHomeQueries.ts`,
      `categoryQueries.ts`, `categoryMutations.ts`,
      `transactionMutations.ts`) were verified to actually route through
      `requestWithAuth`, since every screen test mocks the whole API module
      away; a regression reverting a hook to call the API directly would
      slip through undetected. Fixed by extracting each `queryFn`/
      `mutationFn` body into its own plain, exported function that takes
      `requestWithAuth` as a parameter (same reasoning `graphqlRequest`
      already takes `accessToken` explicitly, see `graphqlClient.ts`) —
      e.g. `currentMonthQueryFn(requestWithAuth)`,
      `createTransactionMutationFn(requestWithAuth)` — so a test can pass a
      mock and assert it was actually called, without `renderHook` (which
      hangs combined with `useQuery` in this environment). `AuthContext.tsx`
      exports the `RequestWithAuth` type for this. New test files
      `budgetHomeQueries.test.ts`/`categoryQueries.test.ts`, and new
      describe blocks in the existing `categoryMutations.test.ts`/
      `transactionMutations.test.ts`, cover all ~14 — each was verified to
      actually fail if the wiring is bypassed (spot-checked by temporarily
      hardcoding a token past `requestWithAuth` in one function and
      confirming its test fails, then restoring it).
      **codebase-auditor**: one real bug, one stale comment, one dead
      export. (1) **Bug**: the last-used-category default in
      `add-transaction.tsx` took `transactionsQuery.data?.[0]` — *all*
      transactions this month, income included — while `categoryMonths` is
      EXPENSE-only; if the month's most-recently-dated transaction happened
      to be income (e.g. today's salary, yesterday's groceries), the
      category lookup silently missed and fell through to the first-in-list
      default instead of finding the actual last-used expense category.
      Fixed with `.find(t => t.direction === 'EXPENSE')` instead of `[0]`
      (this screen only ever creates EXPENSE transactions), covered by a
      new regression test verified to fail without the fix. (2) Dropped a
      comment clause in `transactionMutations.ts` still referencing the
      Expenses tab's per-row percent, removed in an earlier pass (see
      above) — comment no longer describes anything the code shows. (3)
      Deleted `percentSpent` (`budgetHomeCalculations.ts`) and its test —
      zero remaining callers after the row-layout-tweaks pass removed
      `ListRow`'s `percentText` prop, the thing it computed the value for;
      left orphaned at the time rather than cleaned up alongside it. 284
      tests total across 35 suites.
- [x] Two small usability fixes, reported directly against the running
      app: (1) `IconPicker`'s grid (`src/components/IconPicker.tsx`) was
      left-aligned per row, leaving a ragged, sometimes wide gap on the
      right whenever a row of icons didn't exactly fill the container —
      added `justifyContent: 'center'` so a partially-filled row centers
      instead. (2) `ExistingCategoryPicker` (used by Add/Edit
      Transaction's category picker and Add Category's existing-category
      choice) now sorts its `categories` prop alphabetically by name
      before rendering, instead of echoing whatever order the backend
      happened to return — the backend doesn't document any particular
      `categoryMonths`/catalog ordering, so this is a client-side
      guarantee, not a backend contract. 286 tests total across 35 suites.
- [x] Recurrent and Income tabs — previously data-only stubs (rows
      rendered, but "New ..." rows and every row action were inert, see
      the Budget Home bullet above). Grilled over three rounds (no
      mockup existed for either screen at first; the user then pointed to
      the real ones — `Available Budgeted - Home Available(1)/(2).png`,
      `Shopping pressed expense.png` through `(3)`) before writing any
      code, per `CLAUDE.md`'s "ask before frontend work" rule. One real
      backend gap surfaced and was designed around rather than treated as
      a blocker: **there is no "unmark paid" mutation** —
      `markRecurringPaid` only ever creates a `Transaction`, so unmarking
      (recurring) and clearing a received income (below) both work by
      deleting the transaction(s) the mark/receive action created, using
      transaction `id`s `CATEGORY_MONTHS_QUERY`/`RECURRING_EXPENSES_QUERY`
      now fetch (previously only `date`) — flagged to the user as a
      genuine interface question, not silently worked around.
      - **Recurring expenses**: `app/(app)/add-recurring-expense.tsx`
        (category picker scoped to the *full* EXPENSE catalog, not just
        categories unused this month — a recurring expense can share an
        already-active category; name; a plain 1-31 due-day field, not
        the `AmountKeypad`'s date-mode, since a due day has no
        month/year component; Need/Want toggle, no Savings — the backend
        rejects it; amount — calls `createRecurringExpense`) and
        `app/(app)/edit-recurring-expense.tsx`, reached only by swiping a
        row (tapping does nothing, same as Available/Expenses) —
        combines a Paid/Unpaid pill (instant tap-toggle: Unpaid→Paid
        calls `markRecurringPaid` with whatever amount is currently
        shown + today; Paid→Unpaid deletes every linked transaction this
        month) with full editing of name/category/Need-Want/due-day/
        amount (`updateRecurringExpense`) and Delete
        (`removeRecurringExpenseFromMonth`) in one screen, per the user's
        explicit direction over the grilling rounds. New
        `src/api/recurringExpenseMutations.ts` mirrors
        `transactionMutations.ts`'s shape exactly (plain functions +
        `requestWithAuth`-taking wrappers + hooks).
      - **Income**: still just a `Category` (direction `INCOME`) + a
        per-month budget/expected amount — no new backend entity, and
        deliberately no "expected receipt date" field (would need a
        backend schema change, explicitly deferred by the user).
        `app/(app)/add-income.tsx` mirrors Add Category's
        existing-vs-create flow minus the Need/Want/Savings picker, using
        a new small `INCOME_ICON_PALETTE` (`briefcase`/`shield` —
        already mapped in `CategoryIcon.tsx` but excluded from the
        16-icon expense palette) and a new
        `createIncomeCategoryWithBudget` (sibling of
        `createCategoryWithBudget`, direction fixed `INCOME`, no
        `budgetType`). `app/(app)/income-received.tsx`, reached by
        *tapping* an Income row (the one place Recurrent/Income diverge
        — Income reacts to both tap and swipe, Recurrent only to swipe):
        "Received" has no stored field, it's derived the same way the
        row's own amount already is (`actualAmountCents > 0`); the
        amount keypad prefills with the expected amount but is editable
        for a short/partial payment: confirm always adds one more
        `Transaction` against that income row's own `categoryMonthId`
        (repeatable, for split payments), and the Received/Not-received
        pill is the quick all-or-nothing toggle (tap while Not received
        = same as confirm; tap while Received = clear the month). Swipe
        still opens the *existing* `edit-category.tsx` completely
        unchanged — it was already generic across direction, so
        deleting/renaming/rebudgeting an income category needed no new
        code.
      - Two small existing-file generalizations, both additive/flagged
        rather than silent: `src/lib/unusedCategories.ts`'s
        `filterUnusedExpenseCategories`/`isDuplicateCategoryName` gained
        a required `direction` param (first renamed
        `filterUnusedCategories`) instead of a second income-only copy;
        `IconPicker.tsx` gained an optional `palette` prop defaulting to
        the expense palette, so `add-category.tsx`'s call site needed no
        change. 349 tests total across 40 suites.
- [x] `pr-reviewer` + `test-auditor` pass on the Recurrent/Income branch
      above, and fixes for both. **pr-reviewer**: one blocking bug — the
      Recurrent tab's "unmark paid" action (a loop of `useDeleteTransaction`
      calls) never invalidated `['recurringExpenses']`, so after
      successfully unmarking a bill the Home screen kept showing it as
      "Paid" with stale transaction ids until something else happened to
      invalidate that query. Fixed with a new
      `useUnmarkRecurringPaid` hook (mirrors `useMarkRecurringPaid`'s
      invalidation set). Also hardened both the recurring-unmark and
      income-clear-received delete loops from `Promise.all` to
      `Promise.allSettled` — a partial failure (some transactions deleted,
      some not) now surfaces as an error and skips navigating away instead
      of silently claiming success — and added a client-side guard on
      Edit Recurring Expense's Delete button, since the backend blocks
      `removeRecurringExpenseFromMonth` while any transaction references
      the row (true for anything currently Paid); it now shows "Mark as
      unpaid before deleting" instead of a doomed request's generic error.
      **test-auditor**: two real gaps — the multi-row id-mapping in
      `index.tsx` (`transactions.map(t => t.id)` per row) was only ever
      exercised by single-row fixtures, so a wrong-row-mapping regression
      couldn't have been caught; fixed by adding a second Recurrent and
      Income row to `index.test.tsx`'s fixtures, each with distinct ids.
      The due-day lower bound (0) was untested everywhere, and
      Edit Recurring Expense had no due-day boundary tests at all; both
      fixed. 364 tests total across 40 suites.
- [x] Two follow-up fixes from direct user feedback on the running app,
      both on Add/Edit Recurring Expense: (1) their amount keypad looked
      different from Add/Edit Category's — traced to the container being a
      `ScrollView` with `keypadWrap: { minHeight: 260 }` instead of a plain
      `View` with `keypadWrap: { flex: 1 }` (the category screens'
      pattern), needed at the time because the separate due-day row (see
      next point) made the form taller. Once that row was removed, both
      screens switched back to the exact same `View`/`flex: 1` structure
      as `add-category.tsx`/`edit-category.tsx`. (2) Due day was a plain
      numeric `TextInput` row; the user asked for it to reuse the shared
      `AmountKeypad`'s calendar-toggle key instead (the same mechanism
      `add-transaction.tsx` already uses for its date), with a "Due date
      day" placeholder. New `src/lib/dueDayInput.ts` mirrors
      `dateInput.ts`'s day-only helpers but deliberately has **no
      month/calendar context** — `RecurringExpense.dueDay` is a bare Int,
      1-31 always valid regardless of which real month it falls in, unlike
      a transaction's actual date. Both screens now hold the due day as a
      committed-value + typed-buffer pair (same split
      `add-transaction.tsx` uses for its date): the buffer resets to `''`
      every time day-entry mode is (re-)entered, so on Edit (where the due
      day is pre-filled) the first digit typed replaces the old value
      outright instead of appending onto it or being rejected as "already
      2 digits" — the display falls back to the last committed value only
      while the buffer is still empty, and re-entering day-entry mode after
      typing (without confirming) correctly shows what was just typed, not
      the original pre-filled value. 385 tests total across 41 suites.
- [x] Six more follow-up fixes on Recurring Expense, from direct user
      feedback against the running app. **Drawer presentation bug**:
      `app/(app)/_layout.tsx` never registered `add-recurring-expense`,
      `edit-recurring-expense`, `add-income`, or `income-received` with
      `presentation: 'modal'` — each screen's own grabber/bottom-sheet JSX
      was correct, but without this Stack.Screen entry it just pushed as a
      plain full-screen route. Added a regression test
      (`tests/app/(app)/_layout.test.tsx`) asserting every non-index screen
      is registered as a modal, so this can't silently recur. **Recurrent
      row layout**: Paid/Unpaid moved from the subtitle slot (under the
      name) to `secondaryAmountText` (under the amount, matching the
      mockup); the now-empty subtitle shows a literal "WIP due date"
      placeholder (no real per-row due-date display exists yet).
      **Icon-tap-to-pay**: `ListRow` gained an optional `onIconPress` prop
      (every other call site unaffected when omitted) — tapping a
      Recurrent row's icon marks it paid directly, one plain full-amount
      transaction dated today; only wired for unpaid rows (an already-paid
      row's icon has no handler), split/partial payments deferred per the
      user. **Need/Want removed from both Add and Edit**: the category
      already carries a Need/Want/Savings designation, so asking again was
      redundant. New shared `src/lib/recurringBudgetType.ts`
      (`budgetTypeForCategory`) derives the recurring expense's own
      required `budgetType` from the selected category's, falling back to
      Need for a Savings-budgeted category (never valid for a recurring
      expense). **"Amount" label removed** on both screens — implicit
      from context; "Due day" is kept when the keypad is in date-entry
      mode, since that one does need disambiguating. **Edit's Paid/Unpaid
      pill is now a full-width banner** (`justifyContent: 'space-between'`,
      no `alignSelf: 'flex-start'`) instead of a small round pill, matching
      the mockup. **Edit's due-day backspace behavior reworked**: previously
      a backspace against an untouched pre-filled value was a no-op (fell
      back to showing the old value); now it clears to blank on first
      press, same "first touch replaces/clears outright" pattern as the
      amount field's own `hasEditedAmount` guard, applied to due day via a
      new `hasEditedDueDay` flag. Saving with the due day left blank no
      longer blocks or requires a value at all (Edit's `canSubmit` dropped
      the due-day check entirely, unlike Add, which still requires one) —
      it silently falls back to the row's original due day
      (`dueDay ?? Number(params.dueDay)`), since `RecurringExpenseInput.dueDay`
      is required server-side and there's no "leave unchanged" option to
      send instead. 410 tests total across 43 suites.
- [x] Three more Recurring Expense fixes, from a second round of direct
      user feedback. **Icon tap now toggles both directions** —
      previously only wired unpaid->paid; tapping an already-Paid row's
      icon now unmarks it too (`useUnmarkRecurringPaid`, same hook the
      swipe-to-edit drawer's pill uses, so the `['recurringExpenses']`
      invalidation isn't duplicated), deleting every linked transaction.
      **Amount no longer hides when entering day-entry mode** — previously
      toggling the keypad's calendar key swapped the whole calculator
      display over to the due-day value, which the user found jarring
      ("shrinks the calculator"); the amount (`€` + value) is now always
      visible, and a new due-date row sits below it, always visible too --
      `dateMode` only decides which one the keypad's digits/backspace
      currently affect. **Due day is now a real month-aware date, not a
      bare 1-31 number** — reversed the earlier "no calendar context"
      design: the day (01-31, gray/`colors.text.placeholder`) is now
      validated against the actual day count of the current budget month
      and shown alongside that month's fixed "Mon YYYY" label
      (black/`colors.text.primary`, e.g. "10 Sep 2026"), reusing
      `dateInput.ts`'s existing month-aware day-entry helpers
      (`appendDayDigit`/`backspaceDay`/`formatTypedDay`/
      `isCompleteDayDigits`/`formatMonthYearLabel` — the exact ones
      `add-transaction.tsx` already uses for its date) instead of the
      month-agnostic `dueDayInput.ts` written for the first round of this
      feedback, which is deleted now that nothing uses it — this is
      purely a display/typing constraint (can't type day 31 in a
      30-day month) since `RecurringExpense.dueDay` itself is still
      just a bare Int with no stored month/year. Both Add and Edit now
      fetch `useCurrentMonth()` (Edit didn't before) to get that context.
      398 tests total across 42 suites.
- [x] Wired the real `RecurringExpense.dueDate` now that the backend has
      it — the user updated `docs/PLAN.md`/`docs/SERVICES.md` directly
      (not part of any mobile PR) to add a computed field: `dueDate`
      (bare `YYYY-MM-DD`) resolves the stored `dueDay` (still just an
      Int, 1-31, no stored month/year) against the row's own month,
      clamped to that month's last real day if `dueDay` doesn't fit.
      `RECURRING_EXPENSES_QUERY` now fetches it, `RecurringExpense` (the
      client type) gained the field, and the Recurrent tab's row
      subtitle — a literal "WIP due date" placeholder since that bullet
      above — now shows `formatDate(re.dueDate)`, the same formatter
      already used for the Income/Expenses tabs' date subtitles. Add/Edit
      Recurring Expense's own due-day entry is unaffected: it's still a
      live, user-typed value (client-computed day + month/year label, see
      above) since `dueDate` is a read-only computed field, not something
      `updateRecurringExpense`/`createRecurringExpense` accept. 398 tests
      total across 42 suites (one test's assertion changed, not added).
- [x] Corrected a misreading from two rounds back: Add/Edit Recurring
      Expense's calculator now **swaps** between amount and due-date
      display (single calculator area, toggled by the keypad's calendar
      key) — same mechanism/behavior as `add-transaction.tsx`'s date,
      not the "both always visible in two separate rows" layout built
      right after the "don't shrink the calculator" feedback. That
      feedback was actually about the *keypad itself* getting physically
      smaller (the old `ScrollView` + `minHeight: 260` container, fixed
      separately by switching to `flex: 1`), not about wanting the amount
      permanently on screen. The day/month-year gray/black split styling
      and month-aware validation from the previous pass are unchanged,
      just folded back into the one swapped display instead of a second
      permanent row — `dueDateRow`/`dueDateText` styles removed from both
      screens. 400 tests total across 42 suites.
- [x] Two more fixes, both narrow. **Due-day color bug**: the day in
      Add/Edit Recurring Expense's swapped calculator display was always
      gray (`colors.text.placeholder`), even once a real value was typed
      or (on Edit) pre-filled from the server — should only be gray while
      it's genuinely unset (the `--` placeholder); fixed to
      `dueDayDigits === '' ? colors.text.placeholder : colors.text.primary`
      in both screens, matching the always-black month/year. **Income
      Received screen removed entirely** (`app/(app)/income-received.tsx`
      + its route registration + test deleted) — tapping an Income row
      now toggles received state directly, no drawer, mirroring the
      Recurrent tab's icon-tap-to-pay. Not received → received: one plain
      `Transaction` for the row's expected amount (`monthlyBudgetCents`),
      dated today, via `useCreateTransaction` — confirmed with the user
      that `direction` here is server-derived from the income category
      exactly like every other transaction (see `docs/SERVICES.md`), no
      special-casing needed. Received → not received: deletes every
      transaction linked to that `CategoryMonth` this month
      (`Promise.allSettled`, surfaces a toast on any partial failure,
      same care as the Recurrent equivalent) — no dedicated
      `useUnmarkIncomeReceived` hook needed, unlike Recurrent's
      `useUnmarkRecurringPaid`: "received" is derived from
      `CategoryMonth.actualAmountCents`, which `useDeleteTransaction`
      already invalidates. The row's subtitle (previously the most
      recent transaction's date) now shows "Received"/"Not received"
      instead. 393 tests total across 41 suites.
- [x] Two more Add/Edit Recurring Expense fixes, both from the running
      app. **Name field getting its text selected while typing**: root
      cause traced to the `keyboard-dismiss-overlay` (a full-screen
      `Pressable`, `zIndex: 20`, meant only to eat a stray tap-to-dismiss
      landing on a keypad button underneath) rendering the instant the
      keyboard appears — which is the same moment the name field is
      tapped to start typing, so it sat directly on top of the
      just-focused native `TextInput`. Fixed with a `nameFocused` flag
      (`onFocus`/`onBlur` on the name input) gating the overlay so it
      never covers the field currently being typed into — applied to
      both screens. **Due day no longer required to submit**: previously
      `canSubmit` (Add) blocked confirm entirely if the due day was
      left unset; now it isn't part of that check at all, and
      `handleConfirm` falls back to today's day-of-month
      (`Number(todayIsoDate().split('-')[2])`) when unset, same
      "don't block the save, just assume something reasonable" instinct
      already applied to Edit's blank-due-day case (which falls back to
      the row's *original* value instead, since it has one). 396 tests
      total across 41 suites.
- [x] Two `edit-category.tsx` fixes (this screen is shared by both
      Available/Expense and Income category editing, reached via
      swipe-to-edit on either Home tab). **Icon was not editable at
      all** — it just displayed `params.icon` read-only. Made it
      editable the same way `add-category.tsx`/`add-income.tsx` already
      work: the icon pill is now a `Pressable` (with a chevron
      indicating open/closed state) that opens an `IconPicker` overlay
      scoped to the right palette (`EXPENSE_ICON_PALETTE` or
      `INCOME_ICON_PALETTE`, chosen by `params.direction`); selecting an
      icon updates local state and is sent to `updateCategory` on
      confirm alongside the correctly re-derived color (`colorForIcon`/
      `colorForIncomeIcon`) — this also fixed a latent bug where an
      income category's fixed color was always looked up in the expense
      palette, silently falling back to the wrong color for icons like
      `briefcase`/`shield` that aren't in it. **Amount label always read
      "Total budget"**, even for an income category — now reads
      "Expected income" when `params.direction === 'INCOME'`. Also
      proactively applied the same `nameFocused`-gated
      keyboard-dismiss-overlay fix already made to the recurring-expense
      screens (see above) here too, since this screen has the identical
      overlay pattern and would have the identical latent bug even
      though it hadn't been reported here specifically. 400 tests total
      across 41 suites.
- [x] Swapped the `star` expense icon option for `home` — flagged by the
      user as an icon they didn't recognize the meaning of, with a house
      icon being the more useful option to offer (rent/mortgage-type
      categories). `EXPENSE_ICON_PALETTE` now offers `home` in `star`'s
      old slot (same color, `#EEF3C8`); `CategoryIcon.tsx`'s `ICON_MAP`
      gained `home: 'home-variant'`. The `star: 'star'` mapping is kept
      (not deleted) even though it's no longer offered in the picker —
      `icon` is a persisted free-text `String` on `Category` with no
      backend enum (confirmed against `docs/PLAN.md`'s schema), so any
      category already saved with `icon: 'star'` still needs to resolve
      to a real glyph rather than falling back to the generic one. 400
      tests total across 41 suites (no new tests needed — existing
      palette/picker tests were already icon-agnostic, aside from one
      `edit-category.test.tsx` assertion updated from `star`/`#EEF3C8`
      to `home`/`#EEF3C8`).

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
- `@expo/vector-icons` requires `expo-font`, which itself requires
  `expo-asset` — neither is auto-installed as a transitive dependency and
  both must be added explicitly (`package.json` **and** `app.config.ts`'s
  `plugins` array). `npx expo-doctor` catches missing entries here.
- **A real test account (`you@example.com`) accumulated 33 categories
  instead of 5** — traced to a genuine backend bug (`budget-app-api`, not
  mobile): `authCleanupService`'s revoked-refresh-token cleanup runs on
  every `/auth/request-otp` call and hard-deletes revoked tokens with no
  grace period (unlike the expired-token cleanup, which has a time
  cutoff), so a normal logout → re-login cycle wipes the just-revoked
  token before `verifyOtp`'s `needsSeeding` check runs — that check reads
  "zero refresh tokens for this user" as "this signup never finished,
  re-seed the defaults," which is wrong here since it was a legitimate
  prior login, not a crashed one. Confirmed directly against the DB (`docker
  exec budget-app-api-postgres-1 psql -U budget_app -d budget_app`), not
  guessed. Fix (giving the revoked-token cleanup the same cutoff-based
  grace period) is being handled by a separate agent in that repo, not
  here — flagging only so a mobile session hitting duplicate categories
  in this account doesn't re-diagnose it from scratch.
- **`renderHook` (from `@testing-library/react-native`) combined with a
  real `useQuery` (react-query) hangs indefinitely** — confirmed (via
  `ps aux` showing the process alive at 0% CPU, and file-based synchronous
  logging bypassing stdout buffering) that the hang happens inside the
  synchronous `renderHook(...)` call itself, before it even returns. Root
  cause not fully chased down (would need deep RNTL/react-query internals
  digging); the pragmatic fix is to never unit-test a query hook in
  isolation via `renderHook` — only test data-fetching behavior through a
  full screen `render()` test with the query-hooks module mocked at the
  module level (see `tests/app/(app)/index.test.tsx`).
