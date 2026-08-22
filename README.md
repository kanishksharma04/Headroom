# Headroom

Know what you can actually afford. Headroom is a fee-only personal financial
decision engine for India: it tells you exactly how much you can safely
spend before your next payday, once every commitment you've already made is
accounted for — and helps you decide, with your actual numbers, whether to
prepay a loan or invest instead.

It deliberately does not do budgeting, gamification, a financial health
score, AI chat, document storage, or investment research/execution. The
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
account (you'll land in a short onboarding flow), or sign in with the seeded
demo account:

```
demo@headroom.app / headroom-demo
```

### Environment variables

| Variable       | Purpose                                                        |
| -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string (Neon in production).                 |
| `AUTH_SECRET`  | Auth.js session secret — generate with `npx auth secret`.        |
| `AUTH_URL`     | The app's canonical URL (e.g. `http://localhost:3000`).          |

### Scripts

| Command              | Does what                                              |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server.                                   |
| `npm run build`        | Production build.                                        |
| `npm run typecheck`    | `tsc --noEmit`.                                          |
| `npm run lint`         | ESLint.                                                  |
| `npm test`             | Unit and integration tests (Vitest).                     |
| `npm run test:e2e`     | End-to-end smoke test (Playwright, builds and boots the app). |
| `npm run db:seed`      | Seed a representative demo household.                    |

## Architecture

Next.js 15+ (App Router, React Server Components, Server Actions), TypeScript
strict, Tailwind + shadcn/ui, Prisma over Neon Postgres, Auth.js
(email + password), Zod for all input validation, Recharts for the two
charts in the product, Vitest for unit/integration tests, Playwright for the
end-to-end smoke test.

```
app/
  (auth)/           sign-in, sign-up
  (app)/             today, ahead, worth, goals, decide, records — the six screens
  api/export/         CSV download route handlers (net worth history, a loan's amortisation schedule)
  onboarding/        the one-time minimal setup flow
lib/
  engines/           pure functions — every financial calculation lives here
  services/           orchestrates repositories + engines for a use case
  repositories/       thin Prisma query wrappers, one per model
  validation/         Zod schemas, one per form/entity
  export/              pure CSV formatters, consumed by the api/export route handlers
  money.ts, dates.ts, format-*.ts   shared primitives
prisma/
  schema.prisma       the domain model
  seed.ts             demo household generator
e2e/                  Playwright smoke test
```

Screens read through `services`, which combine `repositories` (data) with
`engines` (calculation) and return plain, already-computed view data — no
financial arithmetic happens in a React component or a route handler.

### Data export

There's no bank sync, so getting your own numbers back out matters:
**Worth** has a CSV export of your full net worth history, and every
liability has a CSV export of its full amortisation schedule plus a
print-friendly page for it — use the browser's own "Print → Save as PDF"
rather than a bundled PDF renderer, since the browser already does this
well and it means one less dependency in the product. This is export
only, deliberately — there's still no statement import or document
storage, matching the "no document storage" principle above.

### The domain model

`User` → `Account` (bank/cash), `Asset` (everything else you own),
`Liability` (loans), `Commitment` (a recurring or one-time inflow/outflow —
salary, rent, EMI, SIP, subscription), `VariableSpendBaseline` (your
day-to-day spending estimate), `Goal`, `Scenario` (a saved what-if). A
`Liability`'s EMI is mirrored into a linked `Commitment` automatically, so it
never has to be entered twice. `NetWorthSnapshot` captures the full balance
sheet once per day, on every mutation — it's the only source of history the
app has, and it's what powers the net worth chart and the "what changed and
why" attribution on the Worth screen.

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
- **`decisions.ts`** — the Decide screen's four tools: prepay-vs-invest
  (compares a loan prepayment's guaranteed return against investing the same
  lump sum at pessimistic/base/optimistic rates, post-capital-gains-tax); an
  affordability check (can a purchase happen without breaching your
  emergency fund target or creating new shortfall risk); an income-change
  model (scales your salary commitment(s) and reruns a 90-day cash-flow
  projection — deliberately not the Headroom Number, which excludes the
  very salary occurrence that bounds its own window); and a job-loss
  runway (projects how long your liquid balance lasts with every
  commitment but salary still applied, plus a smooth daily draw-down of
  your variable-spend estimate).
- **`goals.ts`** — evaluates a savings goal against an inflation-adjusted
  target: what your current pace projects to by the target date, the
  monthly contribution that would close any gap, and an on-track / at-risk
  / off-track status — all off the same compounding formula, walked
  forward for a projection and solved for the months-to-target figure.
- **`networth.ts`** — net worth and per-type allocation, plus attribution
  (splits a period's net worth change into contributions, market movement,
  principal repaid, and other, by diffing two snapshots).
- **`attention.ts`** — flags a projected shortfall, an overdue EMI, or an
  account/asset balance that's gone stale (untouched for two weeks or
  more — the Headroom Number and net worth are only as current as the
  figures behind them) before they become a surprise.

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

Deploys to [Vercel](https://vercel.com) — see `vercel.json` (Mumbai region,
`prisma migrate deploy` runs as part of the build). Point `DATABASE_URL` at
a Neon Postgres instance and set `AUTH_SECRET` / `AUTH_URL` in the project's
environment variables before the first deploy.
