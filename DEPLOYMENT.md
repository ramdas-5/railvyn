# RAILVYN — Deploying to Vercel with Neon PostgreSQL

RAILVYN is a **single Next.js 16 application**, not a separate frontend and backend.
Deploying "the frontend" to Vercel deploys the whole product: the React UI, the
server components, the server actions, the `/api/auth/*` Better Auth handler and
the `/api/runs/[runId]/availability` route. The only external service is the
PostgreSQL database, which lives on **Neon**.

```
Browser ──▶ Vercel (Next.js: UI + server actions + API routes) ──▶ Neon PostgreSQL
```

Because of that, the order matters: **create and migrate the database first, then
import the project into Vercel**. If the database is missing, the public landing
pages still render, but search, auth, booking, operator and admin screens return
an explicit "database not configured" error instead of fake data.

---

## 0. Prerequisites

| Item | Notes |
| --- | --- |
| GitHub repository | This repo is already on `origin` (`github.com/ramdas-5/railvyn`). Push all work first. |
| Neon account | <https://console.neon.tech> — free tier is enough for a demo. |
| Vercel account | <https://vercel.com> — Hobby plan is fine. |
| Node.js ≥ 20.9 | `node -v`. Vercel will use 22.x unless configured otherwise. |
| pnpm 12.16.1 | Pinned in `package.json` (`packageManager`). Vercel reads this field. |

Local check before you deploy (all three must pass):

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm build` currently succeeds (Next.js 16.4.5, all app routes dynamic).

---

## 1. Create the Neon database

1. Open <https://console.neon.tech> → **New Project**.
   - Name: `railvyn`
   - Postgres version: 17 (any recent version works)
   - Region: pick the one closest to your Vercel function region. Vercel's
     default is `iad1` (Washington, D.C. / us-east-1), so **AWS us-east-1** is
     the best pairing.
2. In the project dashboard, open **Connect** (or **Connection string**) and:
   - Enable **Connection pooling**
   - Copy the string. It looks like:
     ```
     postgresql://neondb_owner:XXXXXXXX@ep-cool-name-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - The `-pooler` in the host is required for the Vercel runtime. RAILVYN
     already sets `prepare: false`, which Neon's transaction pooler needs.
3. Keep this string secret. It is the only database variable RAILVYN reads:
   `NEON_DATABASE_URL` (there is no `DATABASE_URL` fallback).

### 1a. Apply the schema and seed data (recommended path)

Run the versioned Drizzle migrations from your machine against Neon, then load
the demonstration data.

**PowerShell**

```powershell
$env:NEON_DATABASE_URL="postgresql://...-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
pnpm install
pnpm db:migrate      # applies drizzle/0000_*.sql and drizzle/0001_*.sql
pnpm db:seed         # base demo: 63 stations, 30 trains, 300 runs, 100 bookings
# optional, adds the big demo dataset (1,000 stations, ~9,940 runs, 1.35M seats):
pnpm db:seed:large
```

**bash / Git Bash**

```bash
export NEON_DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
pnpm install && pnpm db:migrate && pnpm db:seed
```

> If the pooler refuses the migration connection (rare), run only
> `db:migrate` with the **direct** host from Neon (remove `-pooler`), then put the
> pooled string back for the app.

### 1b. Alternative: one-file SQL setup in the Neon SQL Editor

[`railvyn-neon-setup.sql`](railvyn-neon-setup.sql) contains schema + demo seed +
bulk dataset in one 7.3 MiB file. Paste it into the Neon **SQL Editor** and press
**Run** (not *Explain*).

- It **drops and recreates the `public` schema**. Use a dedicated demo database.
- Choose **either** this file **or** `pnpm db:migrate` — never both.
- If the editor rejects the size, use `psql "$NEON_DATABASE_URL" -f railvyn-neon-setup.sql`
  or fall back to `pnpm db:migrate && pnpm db:seed`.

### 1c. Verify

In the Neon SQL Editor:

```sql
select count(*) from stations;        -- 63 (or 1063 with bulk)
select count(*) from train_runs;      -- 300 (or ~10240 with bulk)
select count(*) from seat_segment_claims;
```

If these fail, the schema was not applied — do not continue to Vercel yet.

---

## 2. Push the code to GitHub

```bash
git status
git push origin main
```

Vercel deploys whatever is on the branch you select, so make sure the commit you
built locally is the commit you pushed.

---

## 3. Import the project into Vercel

1. Go to <https://vercel.com/new> and import `ramdas-5/railvyn`.
2. Accept the detected settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | **Next.js** (auto-detected) |
   | Root Directory | `./` (repository root — *not* `src`) |
   | Build Command | `pnpm build` (auto) |
   | Output Directory | `.next` (auto) |
   | Install Command | auto — pnpm is detected from `pnpm-lock.yaml` + `packageManager` |
   | Node.js Version | 22.x (Project → Settings → General) |

3. Do **not** set an output directory of `out` or `dist`; this is a server-rendered
   app, not a static export.

---

## 4. Set environment variables

Project → **Settings → Environment Variables**. Add these for **Production**
(and **Preview** if you also want preview sign-in to work):

| Variable | Value | Required |
| --- | --- | --- |
| `NEON_DATABASE_URL` | The pooled Neon connection string from step 1 | **Yes** |
| `BETTER_AUTH_SECRET` | Random 32+ byte secret (see below) | **Yes** |
| `BETTER_AUTH_URL` | `https://<your-production-domain>` — no trailing slash | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Same value as `BETTER_AUTH_URL` | Yes (for consistency) |
| `HOLD_TTL_SECONDS` | `300` (seat hold lifetime, default 5 min) | Optional |
| `WAITLIST_OFFER_TTL_SECONDS` | `600` (waitlist offer window) | Optional |
| `MAX_SEATS_PER_BOOKING` | `6` | Optional |
| `CRON_SECRET` | Random secret, only if you add a cleanup cron later | Optional |

Generate the auth secret:

```bash
openssl rand -base64 32
```

PowerShell equivalent:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

### Getting `BETTER_AUTH_URL` right

Better Auth signs sessions and sets secure (HTTPS-only) cookies in production.
If this value is missing, it falls back to `http://localhost:3000` and **sign-in
will silently fail or bounce you to the wrong host**.

- If you name the Vercel project `railvyn`, the production URL is
  `https://railvyn.vercel.app`. Use exactly that.
- If you are not sure of the URL yet: deploy once, copy the assigned domain, then
  add `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` and **redeploy** (Deployments →
  ⋯ → Redeploy). Auth works only after the redeploy.
- Adding a custom domain later means updating both variables and redeploying.

---

## 5. Deploy

Press **Deploy**. Expected build steps:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` → Next.js compile + TypeScript check
3. Routes are emitted as dynamic (`ƒ`) except `/_not-found` and `/forgot-password`.

A clean build takes roughly 1–3 minutes. The build does **not** require the
database to be reachable; database access happens at request time.

---

## 6. Post-deploy verification checklist

Open your production URL and walk through:

1. **Landing + search** — `/` renders, Railway demo disclaimer is visible.
2. **Auth** — sign in as `admin@railvyn.demo` with password `RailvynDemo#2026`.
   (Every seeded account uses this password.)
3. **Passenger flow** — search a station pair and date → open a run → pick seats →
   place a hold → complete the **demo** checkout → ticket shows an internal
   `RVN-…` reference → cancel it.
4. **Journey-aware inventory** — book a seat on a short leg, then confirm the same
   seat is offered for a non-overlapping leg and blocked for an overlapping one.
5. **Operator** — sign in as `operator@railvyn.demo`, confirm only in-scope runs
   appear and another operator's runs do not.
6. **Admin** — analytics and audit pages load real aggregates (not zeros).

Demo accounts:

| Account | Role |
| --- | --- |
| `passenger@railvyn.demo` | Passenger |
| `operator@railvyn.demo` | Operator (scoped) |
| `admin@railvyn.demo` | Administrator |

---

## 7. Optional: custom domain

1. Vercel → Project → **Settings → Domains** → add your domain and follow the DNS
   instructions.
2. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the new `https://` domain.
3. Redeploy so the new values reach the runtime.

---

## 8. Preview deployments (important)

Every preview deployment gets a unique URL (`railvyn-git-branch-….vercel.app`).
Better Auth's `baseURL` is a single fixed value, so with a production-only
`BETTER_AUTH_URL` **sign-in on preview URLs will not work** — the app will still
render and search will sometimes work, but sessions won't stick.

Options:

- Keep `BETTER_AUTH_URL` scoped to **Production** only and treat previews as a
  visual check.
- Or create a dedicated preview database + preview-only env values pointing at a
  stable preview branch domain.
- Never point previews at the production database; booking/seed operations mutate
  real rows.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `No NEON_DATABASE_URL is configured` | Variable missing for that environment, or not redeployed | Add it in Settings → Environment Variables, then redeploy |
| Sign-in appears to succeed but you stay logged out / redirected to `localhost:3000` | `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL` missing/wrong | Set both, redeploy; URL must be the exact `https://` domain |
| `relation "bookings" does not exist` | Schema never applied | `pnpm db:migrate` against Neon (step 1a) |
| `too many connections` / intermittent 500s under load | Using the direct host instead of the pooler | Use the `-pooler` connection string |
| `password authentication failed` | Truncated connection string | Recopy from Neon → Connect → pooled |
| Build fails at `pnpm install` | Vercel could not resolve `pnpm@12.16.1` | Set Install Command to `pnpm install --frozen-lockfile`, or align `packageManager` with a Vercel-supported pnpm major |
| Build fails on TypeScript | Local `pnpm typecheck` would fail too | Fix locally, commit, push |
| Pages load but every number is 0 / lists empty | Database migrated but not seeded | `pnpm db:seed` (destructive — demo data only) |
| Slow first request after idle | Neon compute auto-suspend | Expected on free tier; the first query wakes it |

Logs: Vercel → Project → **Logs** (runtime) and the deployment's **Build Logs**.

---

## 10. Operational notes

- **Expired seat holds** are cleaned up lazily inside the allocation and
  confirmation transactions. Correctness never depends on a scheduler, so you do
  **not** need Vercel Cron (Hobby allows only once-daily anyway). A cleanup
  endpoint is an optional optimisation only.
- **Never run `pnpm db:seed` or `pnpm db:seed:bulk` against a database whose data
  you want to keep** — both reset application tables, including auth users.
- **Do not apply both** `railvyn-neon-setup.sql` and `pnpm db:migrate` to the same
  database.
- **Payments are simulated** and unmistakably labelled; no card data is stored and
  no payment provider is contacted.
- **Booking references are internal RAILVYN references**, not IRCTC/Indian
  Railways PNRs. Keep that disclaimer visible in the UI and in your
  presentation — it is a core requirement of this project.
- The `.env.example` file is the canonical list of variables. Never commit real
  secrets; `.env.local`, `.env.test` values for real hosts, and any `.env.*.local`
  files are ignored by git.

---

## 11. Quick command recap

```bash
# 1. verify locally
pnpm install && pnpm typecheck && pnpm lint && pnpm build

# 2. prepare Neon (pooled URL)
export NEON_DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
pnpm db:migrate && pnpm db:seed

# 3. ship
git push origin main
# 4. import in Vercel, set env vars, deploy, sign in as admin@railvyn.demo
```
