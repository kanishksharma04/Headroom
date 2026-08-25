# Headroom

Know what you can actually afford. Headroom is a fee-only personal financial
decision engine for India: it tells you exactly how much you can safely
spend before your next payday, once every commitment you've already made is
accounted for — and helps you decide, with your actual numbers, whether to
prepay a loan or invest instead.

It deliberately does not do budgeting, gamification, or document storage.
Ask, its AI assistant, only ever answers from your real numbers via
read-only tools — it never invents a figure and can't edit anything. The
discipline is the product: a small number of numbers, verified precisely,
shown clearly.

## Getting started

**Requirements:** Node 20+, a Postgres database (Neon in production, any
local Postgres for development), npm.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, AUTH_URL
npx prisma migrate deploy
npm run db:seed        # optional — creates a representative demo household
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for a fresh
account — you'll land in a short setup flow, either answering four questions
by hand or importing a bank statement CSV to prefill them — or sign in with
the seeded demo account:

```
demo@headroom.app / headroom-demo
```

### Environment variables

| Variable         | Purpose                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`   | Postgres connection string (Neon in production). Required.                     |
| `AUTH_SECRET`    | Auth.js session secret — generate with `npx auth secret`. Required.            |
| `AUTH_URL`       | The app's canonical URL (e.g. `http://localhost:3000`). Required.              |
| `RESEND_API_KEY` | Enables the daily attention-digest email. Optional — unset means it's skipped. |
| `EMAIL_FROM`     | Digest sender address, e.g. `Headroom <notifications@headroom.app>`. Optional. |
| `CRON_SECRET`    | Authorises the digest's cron trigger. Required in production.                  |
| `ANTHROPIC_API_KEY` | Enables the Ask assistant. Optional — unset means `/assistant` shows a "not configured" state. |
| `ANTHROPIC_MODEL`   | Overrides the Ask assistant's model (default `claude-sonnet-5`). Optional.      |

### Scripts

| Command             | Does what                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Start the dev server.                                            |
| `npm run build`       | Production build.                                                |
| `npm run typecheck`   | `tsc --noEmit`.                                                  |
| `npm run lint`        | ESLint.                                                          |
| `npm run format`      | Prettier, applied.                                               |
| `npm test`            | Unit and integration tests (Vitest).                             |
| `npm run test:e2e`    | End-to-end smoke test (Playwright, builds and boots the app).    |
| `npm run db:seed`     | Seed a representative demo household.                            |

## What it does

Six screens, reached from the sidebar:

- **Today** opens to one number: what's safe to spend before your next
  salary lands, after every bill and EMI already due in that window is set
  aside. Below it, what's coming up next, and your net worth for reference.
- **Ahead** is a day-by-day forecast of your account balance for the next
  30, 60, or 90 days, so a cash crunch shows up before it happens rather
  than after.
- **Worth** is your full financial picture — every account, investment, and
  loan, rolled up into one net worth figure, with a history chart and a
  plain-English note on what changed this month and this year and why. If
  you have enough history, it also shows how fast that net worth is
  compounding annually, and if anything is shared with a partner, a split
  between what's individually yours and what's joint.
- **Goals** tracks savings goals — a child's education, a house down
  payment — adjusted for inflation, with an honest read on whether your
  current pace actually gets you there on time.
- **Decide** has five calculators for the big choices: prepay a loan or
  invest the money instead; whether refinancing a loan elsewhere actually
  pays for itself; can you afford a purchase without wrecking your safety
  net; what a raise or a pay cut actually does to your finances; and how
  long your savings would last if your income stopped today.
- **Records** is every account, loan, and recurring payment you've entered,
  in one searchable, editable list — for double-checking the raw numbers
  behind everything else.

A seventh, differently-natured screen sits in the same sidebar:

- **Ask** is a conversational front end to the six screens above — type a
  question in plain English ("What's my job-loss runway?", "Can I afford a
  ₹15L car this year?") and it answers by calling the same read-only tools
  that power Today, Worth, Goals, and Decide. It never invents a number and
  can't create, edit, or delete anything; a daily question limit keeps API
  cost bounded.

A few more things live outside the main navigation, reached from the
sidebar's icon row instead:

- **Two-factor login** — optional. Turn it on from the shield icon, scan a
  QR code with an authenticator app, and a 6-digit code (or a backup code)
  is required at sign-in from then on.
- **Getting your data in and out** — new accounts can import a bank
  statement CSV instead of typing everything by hand; Headroom picks out a
  current balance and anything that repeats (rent, an EMI, a subscription)
  and asks you to confirm before saving anything. That's not a one-time
  thing — Worth's "Sync statement" re-runs the same reading against an
  existing account any time, refreshing its balance and picking up any
  *new* recurring payment, while leaving whatever's already tracked alone.
  Going the other way, Worth can export your net worth history as CSV, and
  any loan can export its full repayment schedule as CSV or a print-ready
  page.
- **Daily email alerts** — if something needs attention (a projected
  shortfall, a loan payment that looks unpaid, a balance gone stale) and
  you haven't opened the app, Headroom can email you once a day. Silent on
  every day there's nothing to say.
- **Install it like an app** — add Headroom to a phone's home screen for
  one-tap access.

## Architecture

Next.js 16 (App Router, React Server Components, Server Actions), TypeScript
strict, Tailwind + shadcn/ui, Prisma over Neon Postgres, Auth.js
(email + password, optional TOTP two-factor), Zod for all input validation,
Recharts for the product's charts, Resend for the attention digest, Vitest
for unit/integration tests, Playwright for the end-to-end smoke test.

```
app/
  (auth)/           sign-in, sign-up
  (app)/             today, ahead, worth, goals, decide, assistant, records — the seven screens
                      — plus /security, account management, not an eighth screen
  api/export/         CSV download route handlers (net worth history, a loan's amortisation schedule)
  api/cron/            the attention-digest cron trigger
  api/assistant/        the Ask chat endpoint
  onboarding/        the one-time minimal setup flow, plus onboarding/import for the CSV path
lib/
  engines/           pure functions — every financial calculation lives here
  services/           orchestrates repositories + engines for a use case
  repositories/       thin Prisma query wrappers, one per model
  validation/         Zod schemas, one per form/entity
  export/              pure CSV formatters, consumed by the api/export route handlers
  import/               statement CSV parsing + recurring-payment detection, used by onboarding and Worth's statement sync alike
  email/                digest email content + the Resend send wrapper
  auth/                 TOTP and backup-code logic, consumed by auth-service.ts
  ai/                    Ask's Anthropic client, system prompt, and tool definitions
  money.ts, dates.ts, format-*.ts   shared primitives
prisma/
  schema.prisma       the domain model
  seed.ts             demo household generator
e2e/                  Playwright smoke test
```

Screens read through `services`, which combine `repositories` (data) with
`engines` (calculation) and return plain, already-computed view data — no
financial arithmetic happens in a React component or a route handler.

### The domain model

`User` → `Account` (bank/cash), `Asset` (everything else you own),
`Liability` (loans), `Commitment` (a recurring or one-time inflow/outflow —
salary, rent, EMI, SIP, subscription), `VariableSpendBaseline` (your
day-to-day spending estimate), `Goal`, `Scenario` (a saved what-if),
`AssistantMessage` (one row per turn of Ask's single ongoing conversation).
A `Liability`'s EMI is mirrored into a linked `Commitment` automatically, so
it never has to be entered twice. `NetWorthSnapshot` captures the full
balance sheet once per day, on every mutation — it's the only source of
history the app has, and it's what powers the net worth chart and the
"what changed and why" attribution on the Worth screen. `LoginAttempt` sits
outside this `User`-owned hierarchy entirely — it's keyed by the raw email
string submitted at sign-in, not a `User` relation, so the sign-in rate
limiter works even against an email with no account at all.

### The engines (`lib/engines/`)

Every one of these is a pure function — no I/O, no Prisma, fully unit
tested with hand-verified fixtures (see the doc comments at the top of each
`*.test.ts` file for how each fixture was independently checked).

- **`headroom.ts`** — the Headroom Number. Forward-projects your balances to
  the next salary date (or 30 days out if no salary is on file), nets out
  every commitment due in that window, and returns what's left to spend
  safely — with a full line-by-line breakdown of every balance, inflow, and
  outflow that fed the number.
- **`commitments.ts`** — turns a `Commitment`'s recurrence rule (frequency +
  anchor day, with correct month-end handling — a commitment anchored on the
  31st correctly falls on the 28th/29th in February) into concrete
  occurrences within any date window.
- **`ahead.ts`** — projects cash flow forward 30/60/90 days for the Ahead
  screen's timeline and running balance.
- **`amortisation.ts`** — reducing-balance EMI calculation and full
  amortisation schedules, prepayment simulation (reduce-tenure or
  reduce-EMI), and the Section 24(b) tax-deduction-capped effective
  post-tax cost of debt.
- **`decisions.ts`** — the Decide screen's five tools: prepay-vs-invest, a
  refinance comparison (staying on a loan versus moving its full
  outstanding balance to a new rate elsewhere, net of the old loan's
  foreclosure penalty, the new lender's processing fee, and any Section
  24(b) deduction given up), an affordability check, an income-change model
  (a raise or a pay cut, shown as a 90-day cash-flow projection), and a
  job-loss runway (how long your balance lasts with salary stopped and
  everything else unchanged).
- **`goals.ts`** — evaluates a savings goal against an inflation-adjusted
  target: what your current pace projects to by the target date, the
  monthly contribution that would close any gap, and an on-track / at-risk
  / off-track status.
- **`networth.ts`** — net worth and per-type allocation; attribution
  (splits a period's net worth change into contributions, market movement,
  principal repaid, and other, by diffing two snapshots — run both
  month-over-month and year-over-year); and compound annual growth rate
  since the first recorded snapshot.
- **`attention.ts`** — flags a projected shortfall, an overdue EMI, or an
  account/asset balance that's gone stale (untouched for two weeks or
  more) before they become a surprise.
- **`import/`** (`lib/import/`, not `lib/engines/`, but the same pure-function
  discipline) — parses a bank statement CSV and pattern-matches recurring
  payments by interval and amount consistency.

### Design decisions that aren't obvious from the code

- **2FA is two round trips, not one extra field.** Submitting email +
  password alone returns a "needs a code" signal from an email lookup
  only — no password check yet — so an ordinary sign-in still costs
  exactly one bcrypt compare. The password is fully re-verified once the
  code is submitted. (`lib/auth/totp.ts`, `lib/auth/backup-codes.ts`)
- **The service worker deliberately caches nothing.** This app shows live
  financial data; a cached Headroom Number or balance served while offline
  would be a stale figure presented as current, which is worse than the
  app simply not loading. (`public/sw.js`)
- **Statement import shows suggestions, never saves automatically.** A
  payment only becomes a suggestion if it repeats on a consistent interval
  and amount — a one-off UPI payment or ATM withdrawal never matches
  twice, so it's never suggested. The uploaded file is parsed in memory
  for the one request and never stored. (`lib/import/`)
- **Re-syncing a statement matches existing commitments by name, not
  amount.** A rent increase or a SIP top-up between syncs is exactly the
  kind of amount drift this needs to tolerate, not flag as a new payment —
  so `excludeAlreadyTrackedCommitments` keys on direction + name only.
  (`lib/import/detect-commitments.ts`)
- **Individual + joint net worth always equals the combined total
  exactly.** `Liability` carries `isJoint` alongside `Account` and
  `Asset` — a joint home loan deducted entirely from an "individual"
  total would make the split actively misleading, not just incomplete.
  (`splitNetWorthByOwnership` in `networth.ts`)
- **CAGR is hidden, not wrong, when it can't be computed honestly.** It
  needs at least 180 days of history and a positive starting net worth —
  there's no meaningful "growth rate" from a negative net worth, which is
  normal for anyone a few years into a large home loan. (`calculateCagr`
  in `networth.ts`)
- **The attention digest never says "all clear."** It emails only users
  who actually have something flagged; a quiet day sends nothing. With no
  `RESEND_API_KEY` set, sending silently no-ops rather than throwing, so
  local dev and unconfigured deployments keep working.
  (`app/api/cron/attention-digest`, `lib/email/`)
- **Ask's tools can't be told whose data to fetch.** Every tool's JSON
  schema is free of a `userId` field by construction — each tool executor
  closes over the session's `userId` instead, so even a hallucinated or
  adversarial tool call can only ever touch the signed-in user's own
  records. A 40-questions/day cap and a 5-round tool-use limit bound the
  cost of a single conversation; only the last 20 messages are replayed to
  Claude each turn so a long-lived conversation's context doesn't grow
  unboundedly, even though the page itself shows full history.
  (`lib/ai/assistant-tools.ts`, `lib/services/assistant-service.ts`)
- **Sign-in is rate-limited per email, not per IP.** An attacker who
  already has (or is guessing at) one specific account's password cares
  about that account regardless of how many IPs they attempt from — so
  the limiter counts recent failures against the submitted email itself
  (10 password attempts / 15 minutes; a stricter 5 for the TOTP/backup-code
  round, since that's the higher-value target). It works even for emails
  with no account, since `LoginAttempt` isn't tied to a `User` row. Checked
  before `signIn()` runs, so a locked-out email costs neither a bcrypt
  compare nor a TOTP check; cleared on a successful sign-in from inside
  `authorize()` itself, the one place guaranteed to run to completion
  before Auth.js's redirect fires. (`lib/services/login-rate-limit-service.ts`)

## Money rules

These are non-negotiable and enforced throughout the codebase:

1. **Never a JavaScript `number` for money.** Every monetary value is a
   [`decimal.js`](https://mikemcl.github.io/decimal.js/) `Decimal`
   (`lib/money.ts`'s `Money` type is a semantic alias for it). Prisma stores
   money as `Decimal @db.Decimal(18,4)`.
2. **Money crosses the client/server boundary as a string.** Forms submit
   money as validated decimal strings (`lib/validation/money.ts`); Server
   Components serialise `Decimal` to a string before it reaches a Client
   Component.
3. **`ROUND_HALF_UP` only at the edge** — display formatting
   (`lib/format-money.ts`) and settlement, never mid-calculation. Every
   intermediate step in an engine keeps full `Decimal` precision.
4. **Every calculation lives in a pure `lib/engines/` function**, unit
   tested against hand-verified fixtures. No arithmetic on money in a
   component, route handler, or service.
5. **Indian formatting throughout**: `₹1,20,000` lakh/crore digit grouping,
   `₹1.2L` / `₹3.4Cr` shorthand in summaries only (never in a place where
   precision matters), dates as `5 Sep` / `5 September 2026`, and every date
   computation is `Asia/Kolkata`-aware (`lib/dates.ts`) — critical because a
   naive `Date.getUTCDay()` on an IST-midnight instant reads the wrong
   calendar day.

## Testing

`npm test` runs the full unit/integration suite (engines, services,
formatters) against real fixtures — several tests run against a live
Postgres to verify repository and snapshot behaviour end to end.
`npm run test:e2e` builds a production bundle and runs the one true
end-to-end path: sign up → complete onboarding → see a real Headroom Number
rendered. Everything else is covered at the engine and integration level,
since that's where financial correctness actually lives.

## Deploying

Deploys to [Vercel](https://vercel.com) — see `vercel.json` (Mumbai region;
the build explicitly runs `prisma generate` before `prisma migrate deploy`,
rather than relying on Prisma's own install-script to generate the client,
since Vercel's build image can gate package install scripts; a daily cron
trigger handles the attention digest). Before the first deploy, set in the project's
environment variables:

- `DATABASE_URL` pointed at a Neon Postgres instance, `AUTH_SECRET`, and
  `AUTH_URL` — all required.
- `CRON_SECRET` — required, or the digest's cron endpoint stays disabled
  (it fails closed rather than running unauthenticated).
- `RESEND_API_KEY` and `EMAIL_FROM` — optional; without them the app runs
  fine, the digest just never sends.
