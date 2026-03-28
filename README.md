# AaplaVasaiVirar Backend

API for the **VVMC Hyper-local Platform** (AaplaVasaiVirar.com): building-level directory for Vasai–Virar with human-verified, hyper-local (50m) data.

## Plan & architecture

**→ See [BACKEND_PLAN.md](./BACKEND_PLAN.md)** for the definitive backend plan: tech stack, PostGIS schema, API list by phase, business rules, and execution order.

## Quick start

```bash
cp .env.example .env   # fill DATABASE_URL, JWT_SECRET, SMS_* etc.
npm install
npm run migrate        # run SQL migrations (PostGIS)
npm run dev            # start server
```

### PostgreSQL + PostGIS (local)

If `npm run migrate` fails with **PostGIS not installed** (e.g. with Homebrew `postgresql@14`), use either:

**Option A — Docker (recommended)**  
Runs Postgres 14 + PostGIS with no version mismatch:

```bash
# If postgresql@14 is already using 5432, stop it first: brew services stop postgresql@14
docker compose up -d db
```

Then in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vvmc
```

Then `npm run migrate` and `npm run dev`.

**Option B — Homebrew default PostgreSQL**  
Use the default `postgresql` (not `postgresql@14`) so PostGIS is found:

```bash
brew services start postgresql
createdb vvmc
# In .env use DATABASE_URL with port 5432 and database vvmc
npm run migrate
```

## Stack

- **Node.js + Express** — REST API
- **PostgreSQL + PostGIS** — data and spatial queries (50m radius)
- **Fast2SMS / MSG91** — OTP for verification
- **Supabase or DigitalOcean** — host DB and (optionally) app

## Phases (from blueprint)

1. **Phase 1 (Weeks 1–3):** Volunteer auth + KYC, Add shop with geo-tagging, OTP verification.
2. **Phase 2 (Weeks 4–8):** Leaderboard, admin heatmap, reports.
3. **Phase 3 (Weeks 9–14):** User app, subscriptions (₹49/₹199/₹999), events, shop claim by owner.

Implementation follows [BACKEND_PLAN.md](./BACKEND_PLAN.md).
