# Budget Tracker — Mobile Plan (Phase 2)

> This repo is the **mobile client only**. The backend (Phase 1 — Fastify,
> PostgreSQL, Prisma, the GraphQL schema, all business-rule enforcement)
> lives in a separate repo and is functionally complete. This document
> keeps only what the mobile client needs: the API contract, the wire
> conventions, and the business rules that shape UI behavior. It does not
> cover backend implementation, data model internals, or how the API was
> built — that lives in the backend repo's own docs.

## Overview

A budget/savings tracker, built API-first for real production use. The
mobile app (Expo/React Native) is a thin client over an already-built
GraphQL + REST API — no local SQLite as source of truth, the API is the
source of truth (app can cache/queue for offline later if ever needed).
Phase 3 (website) will later be another thin client on the same API.

## How We Work With Claude Code (frontend-relevant subset)

Full standing rules live in `.claude/CLAUDE.md` (read automatically every
session) — this is just the reasoning behind the ones that matter most here:

- **Frontend work: ask, don't assume.** For every screen/component, ask for
  layout, states, copy, colors, and edge-case behavior before writing code.
  Before starting mobile screen work at all, ask for the design references
  (mockup screenshots + the source Excel structure) rather than guessing.
- **TDD, small steps.** Jest + React Native Testing Library, one small
  verifiable increment at a time.
- **No new dependencies without asking first.**
- **Ubiquitous language.** `docs/GLOSSARY.md` defines domain terms
  precisely — use them exactly in code (types, variables, function names).

## Tech Stack (Mobile)

- [Expo](https://expo.dev/) (React Native) + TypeScript
- Expo Router (file-based navigation)
- `graphql-request` + [`@tanstack/react-query`](https://tanstack.com/query)
  for data fetching/caching — **manual cache invalidation on mutations, no
  normalized GraphQL cache** (no Apollo/urql-style cache normalization)
- Jest + React Native Testing Library

## Talking to the API — conventions the client must follow

- **Money is always integer cents on the wire** (`amountCents`,
  `monthlyBudgetCents`, `targetAmountCents`, etc.) — never float. The
  ×100/÷100 conversion for display and input happens only in the frontend,
  at the UI edge, never before sending or after receiving.
- **Dates are bare `YYYY-MM-DD` strings**, no time-of-day, no timezone
  conversion. The one exception: `BankBalance.checkpointSetAt` is a full
  ISO 8601 timestamp (it anchors an instant, not a calendar day).
- **Enum casing**: the wire format (GraphQL) is always UPPER_CASE
  (`NEED`/`WANT`/`SAVINGS`, `EXPENSE`/`INCOME`, `DEPOSIT`/`WITHDRAW`) —
  already handled server-side, the client just consumes/sends upper-case.
- **Auth is REST, everything else is GraphQL.** `/auth/*` (request-otp,
  verify-otp, refresh, logout, logout-all) and `/account/*` (export,
  delete) are plain REST routes — request/response actions, not really
  "queries". Everything else — categories, transactions, recurring
  expenses, month lifecycle, savings funds, bank balance — is one
  `POST/GET /graphql` endpoint.
- **Token lifecycle**: access JWT (~15 min) + refresh token (~30 days,
  DB-persisted per device, **mandatory rotation** on every refresh — a
  reused old refresh token fails). The app needs silent-refresh handling
  and secure refresh-token storage (`expo-secure-store`, not AsyncStorage).
- **`BudgetMonth` has no `id` field** (deliberate backend design — nothing
  else in the schema references a `BudgetMonth` by id, and `currentMonth`
  can represent a not-yet-persisted month). A normalized cache couldn't
  auto-merge updates after `lockMonth`/`deleteBudgetMonth`; with manual
  React Query invalidation this isn't a blocker, but remember to invalidate
  `currentMonth` + any month-scoped queries explicitly after those two
  mutations.
- **Query depth is capped** (max 10) — irrelevant to normal client usage,
  just don't build deeply recursive queries.
- **`transactions(month, categoryId)` is deliberately unpaginated** — a
  single month's transactions is a bounded, small list (~100 tops), not the
  unbounded case pagination is for. No infinite-scroll needed for that
  screen; would need revisiting only for a future "all history" view.
- **Local API URL**: `http://localhost:4400` (not the `4000` default in the
  backend's `.env.example` — a port collision on the backend dev machine).
  From the **Android emulator**, use `http://10.0.2.2:4400` instead of
  `localhost`.

## Business rules that shape the UI

- **Current month is derived, never explicitly created**: the earliest
  `BudgetMonth` that isn't locked yet for that user, or today's real
  calendar month if none exists.
- **Locking a month freezes it forever** — no more creates/edits/deletes
  against anything in it. Locking is always an explicit user action, never
  automatic by calendar date; a user can keep editing an "old" month
  indefinitely until they choose to lock it.
- **No auto-lock cascade.** If a user hasn't opened the app in a while,
  "current month" just naturally falls back to today's real calendar month
  once nothing unlocked stands in the way — no walk-forward/auto-lock logic
  to account for in the UI.
- **Planning horizon is capped at one month ahead.** A category or
  recurring expense can only be *newly* activated in `[current, current +
  1]` — never further ahead, and never in the past. A user can pre-provision
  the next month early, but not beyond it.
- **Category/budget carry-forward is per-item and explicit**: when planning
  a new month, the client re-queries the previous month's active categories
  (`categoryMonths(month)`) and offers them as a checklist — calling
  `addCategoryToMonth` once per item the user keeps checked (budget omitted
  = inherits the category's most recent budget). There's no dedicated
  "carry forward" mutation.
- **Recurring expenses carry forward automatically**, no per-item opt-in —
  the moment a new month is first touched (by any action), its recurring
  expenses are copied fresh/unpaid from the previous month server-side. The
  client doesn't need to drive this; it just shows what's already there.
- **An empty, unlocked, pre-provisioned month can be deleted**
  (`deleteBudgetMonth`) if the user decides not to use it after all.
- **Computed fields — always fresh from the server, never derive or cache
  these client-side across a mutation without invalidating**:
  `CategoryMonth.actualAmountCents`, `CategoryMonth.recurringCommittedCents`,
  `RecurringExpense.paidThisMonth`, `SavingsFund.currentAmountCents`,
  `SavingsFund.achieved`, `BankBalance.amountCents`.
- **`paidThisMonth`** is `SUM(linked transactions.amountCents) >=
  amountCents` — fully covered, not "any transaction exists." Split
  payments across multiple transactions are normal and expected (e.g. rent
  paid in two installments) — `markRecurringPaid` can be called more than
  once per row.
- **Savings Fund overdraft rule**: a withdrawal (or an edit/delete with the
  same effect) that would leave a fund's balance negative is rejected
  (`insufficient_funds`) — the UI must surface this as a real, expected
  error state, not a generic failure.
- **Income has no separate feature or type.** It's just an income-direction
  `Category`, activated into a month like any other via
  `addCategoryToMonth`, with `monthlyBudgetCents` doubling as "expected
  amount" and `actualAmountCents` as "received so far." Use
  `categoryMonths(month, direction: INCOME)` to power a dedicated income
  view without client-side filtering.
- **Bank Balance is deliberately unrelated to Savings Funds** — moving
  money into a fund never changes it, it's still "the user's money," just
  tracked separately. It's the one money value in the whole app explicitly
  allowed to go negative (a real bank account can overdraft).
- **Hard deletes everywhere, no soft-delete/undo anywhere in the app.**
  Every delete action (category, category-month, transaction, recurring
  expense, savings fund, savings movement, budget month) is immediate and
  permanent. The UI should treat — and probably confirm — every delete as
  irreversible.
- **GDPR account actions exist as REST routes** if/when an account-settings
  screen needs them: `GET /account/export` (full JSON dump, Bearer auth)
  and `DELETE /account` (body `{ confirm: true }`, Bearer auth) — both
  permanent/irreversible on the delete side.

## Out of scope (don't build for these)

- Offline support / sync conflict resolution — API is the source of truth,
  no local persistence layer beyond React Query's own cache.
- Real-time updates — no GraphQL subscriptions exist; refresh via React
  Query invalidation/refetch, not a live socket.
- Pagination beyond month-scoped views — not needed yet (see
  `transactions(month, categoryId)` above).
- Planning further than one month ahead — capped server-side, don't build
  UI that implies otherwise.

## API Schema

Auth (REST, not GraphQL — request/response actions rather than queries):

- `POST /auth/request-otp` — body: `{ email }`. Always `200` regardless of
  whether the email exists (no account enumeration). Rate-limited 3/15min
  by IP+email — the UI should back off a "resend code" action accordingly.
- `POST /auth/verify-otp` — body: `{ email, code, deviceLabel? }` → `200 {
  accessToken, refreshToken, user }`. First-ever login for an email also
  creates the account (seeded with default categories). Rate-limited
  10/15min by IP+email (a secondary backstop — the OTP itself caps wrong
  guesses at 5 attempts, see below). `401` with a specific error code on
  failure (`code_not_found` \| `code_expired` \| `too_many_attempts` \|
  `incorrect_code`).
- `POST /auth/refresh` — body: `{ refreshToken }` → `200 { accessToken,
  refreshToken }`. **Mandatory rotation** — the old token is revoked,
  reusing it fails (`401 { error: "refresh_token_invalid" }`).
- `POST /auth/logout` — body: `{ refreshToken }` → `204`. Revokes one
  device's refresh token.
- `POST /auth/logout-all` — Bearer access token → `204`. Revokes every
  refresh token for the user (all devices).
- `GET /account/export` — Bearer access token → `200`, full JSON export.
- `DELETE /account` — body `{ confirm: true }`, Bearer access token →
  `204`. Permanent, no undo.
- `GET /health` — `200 { status: "ok" }` (not client-relevant, ops only).

Everything else as GraphQL types, queries and mutations:

```graphql
enum BudgetType {
  NEED
  WANT
  SAVINGS
}
enum Direction {
  EXPENSE
  INCOME
}
enum MovementType {
  DEPOSIT
  WITHDRAW
}

type BudgetMonth {
  month: String! # "YYYY-MM"
  locked: Boolean!
  # No id field — every other type denormalizes the month string directly,
  # and currentMonth can represent a not-yet-persisted month.
}

type Category {
  id: ID!
  name: String!
  icon: String!
  color: String!
  budgetType: BudgetType # null when direction is INCOME; required when EXPENSE
  direction: Direction!
}

type CategoryMonth {
  id: ID!
  month: String! # YYYY-MM
  monthlyBudgetCents: Int! # the planned/expected number, either direction
  actualAmountCents: Int! # computed: SUM(amountCents) across this CategoryMonth's transactions
  recurringCommittedCents: Int! # computed: SUM(amountCents) across this category's active recurring expenses this month
  category: Category!
  transactions: [Transaction!]! # this month's transactions for this category
}

type Transaction {
  id: ID!
  amountCents: Int!
  date: String!
  merchant: String
  note: String
  direction: Direction! # denormalized from categoryMonth.category.direction, not client-settable
  categoryMonth: CategoryMonth!
  recurringExpense: RecurringExpense # set only when created via markRecurringPaid; never client-settable
}

type RecurringExpense {
  id: ID!
  month: String! # YYYY-MM
  name: String!
  amountCents: Int! # this month's amount, period — editing it only ever touches this row
  budgetType: BudgetType!
  dueDay: Int!
  category: Category! # an existing category — creating one never creates a category
  paidThisMonth: Boolean! # computed: SUM(linked transactions.amountCents) >= amountCents
  transactions: [Transaction!]! # every transaction linked via markRecurringPaid this month
}

type SavingsFund {
  id: ID!
  name: String!
  targetAmountCents: Int
  initialBalanceCents: Int!
  currentAmountCents: Int! # computed — initialBalanceCents + net of every movement
  startDate: String
  endDate: String
  monthlyTargetCents: Int
  achieved: Boolean! # computed — currentAmountCents >= targetAmountCents, always false if no target
  movements: [SavingsMovement!]!
}

type SavingsMovement {
  id: ID!
  amountCents: Int!
  type: MovementType!
  date: String!
  fund: SavingsFund! # back-reference, mirroring Transaction.categoryMonth
}

type BankBalance {
  amountCents: Int! # computed: checkpointAmountCents + net of every Transaction created after checkpointSetAt
  checkpointAmountCents: Int!
  checkpointSetAt: String! # full ISO 8601 timestamp — the one exception to the bare-date convention
}

input CategoryInput {
  name: String!
  icon: String!
  color: String!
  budgetType: BudgetType # required server-side only when direction is EXPENSE
  direction: Direction!
}

input TransactionInput {
  categoryMonthId: ID!
  amountCents: Int! # must be positive; direction is derived server-side from the category, not accepted here
  date: String!
  merchant: String
  note: String
}

input RecurringExpenseInput {
  name: String!
  amountCents: Int!
  categoryId: ID! # an existing category — never auto-created
  budgetType: BudgetType! # NEED or WANT only — server rejects SAVINGS here
  dueDay: Int!
}

input MarkRecurringPaidInput {
  amountCents: Int! # the actual amount paid — can differ from the row's amountCents (variable bills); positive
  date: String!
  merchant: String
  note: String
}

input CreateSavingsFundInput {
  name: String!
  targetAmountCents: Int
  initialBalanceCents: Int!
  startDate: String
  endDate: String
  monthlyTargetCents: Int
}

input UpdateSavingsFundInput {
  name: String!
  targetAmountCents: Int
  startDate: String
  endDate: String
  monthlyTargetCents: Int
}
# initialBalanceCents is intentionally absent from the update input: it's set once at
# creation and never changed, since currentAmountCents derives from it plus the sum
# of movements — letting it change after movements exist would silently corrupt the balance.

input CreateSavingsMovementInput {
  fundId: ID!
  amountCents: Int!
  type: MovementType!
  date: String!
}

input UpdateSavingsMovementInput {
  amountCents: Int!
  type: MovementType!
  date: String!
}
# fundId is intentionally absent from the update input: a movement can't be reassigned to
# a different fund — out of scope, that's really two funds' balances changing atomically at once.

type Query {
  ping: String! # no auth required — the one field on this endpoint that isn't user-scoped
  currentMonth: BudgetMonth! # derived, never persisted by this query
  categories: [Category!]! # full catalog, every category regardless of month
  categoryMonths(month: String!, direction: Direction): [CategoryMonth!]! # active categories for a month; direction filters income vs expense
  transactions(month: String!, categoryId: ID): [Transaction!]! # ordered date DESC, createdAt DESC; unpaginated
  recurringExpenses(month: String!): [RecurringExpense!]! # this month's recurring expenses
  savingsFunds: [SavingsFund!]!
  bankBalance: BankBalance! # always returns a value, never null
}

type Mutation {
  lockMonth(month: String!): BudgetMonth! # must be the current (earliest unlocked) month
  deleteBudgetMonth(month: String!): Boolean! # hard delete an empty unlocked month

  createCategory(input: CategoryInput!): Category! # pure catalog insert, no activation
  updateCategory(id: ID!, input: CategoryInput!): Category! # blocks a direction change if any transaction or recurring expense references this category
  deleteCategory(id: ID!): Boolean! # blocked unless inactive in every month, past and future

  addCategoryToMonth(categoryId: ID!, month: String!, monthlyBudgetCents: Int): CategoryMonth! # budget optional: inherits the category's most recent budget when omitted
  removeCategoryFromMonth(categoryMonthId: ID!): Boolean! # hard delete; blocked if any transactions reference it that month
  updateCategoryMonthBudget(categoryMonthId: ID!, monthlyBudgetCents: Int!): CategoryMonth! # this month's budget only

  createTransaction(input: TransactionInput!): Transaction!
  updateTransaction(id: ID!, input: TransactionInput!): Transaction!
  deleteTransaction(id: ID!): Boolean! # hard delete, immediate and permanent, no undo

  createRecurringExpense(input: RecurringExpenseInput!, month: String!, categoryMonthlyBudgetCents: Int): RecurringExpense! # month is required; categoryMonthlyBudgetCents required only if the category isn't already active that month
  updateRecurringExpense(id: ID!, input: RecurringExpenseInput!): RecurringExpense! # one flat edit, scoped to this one row/month, no propagation question
  removeRecurringExpenseFromMonth(id: ID!): Boolean! # hard delete; blocked if any transaction references it
  markRecurringPaid(id: ID!, input: MarkRecurringPaidInput!): Transaction! # creates a new Transaction; can be called more than once per row (split payments)

  createSavingsFund(input: CreateSavingsFundInput!): SavingsFund!
  updateSavingsFund(id: ID!, input: UpdateSavingsFundInput!): SavingsFund!
  deleteSavingsFund(id: ID!): Boolean! # hard delete; blocked while any movement references it
  createSavingsMovement(input: CreateSavingsMovementInput!): SavingsMovement! # rejects a withdrawal (or edit) that would leave the fund's balance negative
  updateSavingsMovement(id: ID!, input: UpdateSavingsMovementInput!): SavingsMovement! # amountCents/type/date only, re-checks the resulting balance
  deleteSavingsMovement(id: ID!): Boolean! # re-checks the resulting balance with this movement's effect removed

  setBankBalanceCheckpoint(amountCents: Int!): BankBalance! # overwrites both the checkpoint amount and its timestamp (to now) in one call — no history kept
}
```

There is no `IncomeSource` type/inputs/query/mutations — income is just an
income-direction `Category` (see "Business rules" above).

## Mobile Build Order (planned)

1. **Design interview** — mockups + the source Excel structure. Required
   before any screen work; nothing below starts until this happens.
2. **Expo scaffold** — TypeScript, Expo Router, `graphql-request` +
   `@tanstack/react-query`, Jest + React Native Testing Library.
3. **Auth flow** — OTP request/verify screens, secure token storage,
   silent refresh.
4. **First screens** — TBD, pending the design interview.

Live status/checklist: `docs/PROGRESS-MOBILE.md`.

## Local Setup (mobile)

- The backend must be running locally (separate repo) at
  `http://localhost:4400` (`http://10.0.2.2:4400` from the Android
  emulator) — see that repo for its own setup instructions.
- Expo-specific env/config details: TBD once the scaffold exists.

## Notes for Claude Code

- **Category budget screen — don't let this get lost**: the category-month
  budget editor must offer a "match to recurring total" action using
  `CategoryMonth.recurringCommittedCents` feeding directly into the
  existing `updateCategoryMonthBudget` mutation — one tap, no manual
  arithmetic. For a category dominated by recurring expenses with variable
  amounts (e.g. Housing = fixed rent + variable gas/electricity),
  requiring the user to hand-sum those before typing a budget number
  defeats the point of the app doing the tracking. The backend already
  computes the sum; the frontend just has to surface it and let one tap
  apply it.
