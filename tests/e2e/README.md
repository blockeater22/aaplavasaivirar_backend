# E2E and Load Tests

## Load tests

Load tests use **autocannon** and live in `scripts/load-test.js`. They start the app on a random port and hit key endpoints for a few seconds.

**Run:**
```bash
npm run load-test
```

**Optional env:** `LOAD_CONNECTIONS=50` `LOAD_DURATION=10` `LOAD_PIPELINING=1` (defaults: 10, 5, 1).

**Endpoints:** `/health`, `/shops/nearby`, `/buildings`, `/categories`, `/leaderboard`, `/volunteers/me` (with token if DB available). Output shows requests/sec and latency (p50, p99).

---

## E2E API Tests

End-to-end tests for the backend API. They hit real HTTP endpoints (no server listen; uses supertest).

### Database isolation
By default tests use the **same database** as `DATABASE_URL`.

To prevent test data from polluting your real DB, set:
- `TEST_DATABASE_URL` (point it to a dedicated test DB)

When you run `npm run test:e2e`, tests run with `NODE_ENV=test`, and the backend will use `TEST_DATABASE_URL` instead of `DATABASE_URL`.

## Prerequisites

1. **Database**: Run migrations first:
   ```bash
   npm run migrate
   ```
2. **Env**: `DATABASE_URL` must be set (or `TEST_DATABASE_URL` for isolation). Optional: `JWT_SECRET`, `JWT_VOLUNTEER_AUD`, `JWT_USER_AUD` if you use custom values.

## Run

```bash
npm run test:e2e
```

On Windows (cmd/PowerShell) you may need:

```bash
set NODE_ENV=test && node --test tests/e2e/
```

## What is covered

| Suite | Description |
|-------|-------------|
| **Health** | `GET /health`, 404 for unknown routes |
| **Auth** | Validation and errors for send-otp, verify-otp, register (no real SMS) |
| **Public APIs** | Shops nearby/search, buildings list/at/:id, categories, leaderboard; validation (400/404) |
| **Protected APIs** | Volunteer token required: `/volunteers/me`, POST/PATCH buildings, POST shops; 401 without token, 400 bad body |
| **Security** | 401 missing/invalid token, 403 wrong audience (user token on volunteer route), admin route rejects volunteer token |

## Test volunteer

Protected tests use a seeded volunteer (phone `9999999999`, created once per run). The helper `getTestVolunteerToken()` in `helpers.js` creates a building and volunteer if they don’t exist and returns a valid JWT so tests can call volunteer-only endpoints.
