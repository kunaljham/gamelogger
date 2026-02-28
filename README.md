# GameLogger

A web-based squash match tracker designed to help users log friendly matches with friends, track scores, and maintain match history.

**Live:** https://gamelogger.app

## Tech Stack

**Frontend:**
- **Framework:** [Next.js](https://nextjs.org) (App Router, React 19)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com)
- **Deployment:** [Vercel](https://vercel.com)

**Backend:**
- **Language:** Go 1.22
- **Router:** [chi](https://github.com/go-chi/chi)
- **Database:** PostgreSQL 16 (via [pgx](https://github.com/jackc/pgx))
- **Email:** [Resend](https://resend.com)
- **Deployment:** [Railway](https://railway.app)

## Deployment

The app runs as two separate services:

| Service  | Platform | Production URL |
|----------|----------|----------------|
| Frontend | Vercel   | https://gamelogger.app |
| Backend  | Railway  | API accessed by the frontend at runtime |

### Environments

We have two environments — **staging** and **production** — each with their own isolated infrastructure:

- **Production** — The live site at `gamelogger.app`. Vercel builds from the `main` branch; Railway deploys the backend from the same branch with its own PostgreSQL database and environment variables (session secrets, Resend API key, cookie domain, CORS origins, etc.).
- **Staging** — A separate deployment used for testing changes before they hit production. Both Vercel and Railway provide isolated staging instances with their own databases, so new migrations and features can be validated end-to-end without risking production data.

Each environment has its own set of configuration (database URL, frontend/backend URLs, cookie domain, allowed origins) managed through the respective platform dashboards. See `backend/.env.example` for the full list of environment variables.

### How deploys work

- **Frontend:** Vercel automatically builds and deploys on every push to `main`. Preview deployments are created for pull request branches.
- **Backend:** Railway automatically builds the Go binary using the Dockerfile and deploys on push to `main`. Database migrations are included in the Docker image and run at startup.

## Testing

Testing is split across both the frontend and backend, with a mix of unit tests, integration tests, and end-to-end tests.

### Frontend

**Unit tests** use [Vitest](https://vitest.dev/) for testing utility functions and logic:

```bash
npm test              # Run all unit tests
```

Test files live alongside the code they test (e.g., `src/lib/match.test.ts`).

**End-to-end tests** use [Playwright](https://playwright.dev/) to exercise full user flows (like sign-in) in a real browser:

```bash
npx playwright test   # Runs against localhost:3000 (starts dev server automatically)
```

E2E test files live in the `tests/` directory (e.g., `tests/sign-in-flow.spec.ts`). Playwright is configured to run against Chromium and will start the Next.js dev server if it isn't already running.

### Backend

**Unit tests** use Go's built-in `testing` package plus [testify](https://github.com/stretchr/testify) for assertions. They test HTTP handler validation logic (input parsing, auth checks, score validation) without requiring a database — any test that needs a database is skipped with `t.Skip()`:

```bash
cd backend
make test             # Runs: go test -v -race ./...
make coverage         # Generates an HTML coverage report
```

**Integration tests** use a shell script (`backend/test-api.sh`) that exercises every API endpoint against a running backend. The script uses `curl` for HTTP calls and `psql` to extract magic link tokens directly from the database, covering the full auth flow, match CRUD, opponent management, and edge cases:

```bash
cd backend
make dev              # Start the backend + local PostgreSQL
./test-api.sh         # Run the full integration suite (requires jq and psql)
```

There is also a `testutil/` package with a `TestDB` helper for writing Go-level integration tests against a test database in the future.

### Running everything locally

1. **Backend:** `cd backend && make dev` — starts PostgreSQL (via Docker) and the Go server on `:8080`
2. **Frontend:** `npm run dev` — starts Next.js on `:3000`
3. **Backend unit tests:** `cd backend && make test`
4. **Backend integration tests:** `cd backend && ./test-api.sh` (with backend running)
5. **Frontend unit tests:** `npm test`
6. **Frontend E2E tests:** `npx playwright test`

## Specification

[Full Specification Document](https://docs.google.com/document/d/1pPZOikLIrGjvN0sUy4kVI_5H8Xi0PRL2_RZ_cl9badY/edit?usp=sharing)

### Core Goals

1. Learn full-stack web development through building and deploying an application
2. Leverage modern AI tools during the development process
3. Create a personally useful product during paternity leave

### Key Features

**Authentication & Access**
- Magic link-based authentication (no passwords required)
- Users sign up/log in via email address
- Automatic profile creation for opponents when matches are logged

**Match Recording**
- Final score logging with private per-user notes
- Best of 3 or Best of 5 format options
- Individual game scores tracked
- Chronological feed organization
- Edit and delete capabilities (match creator only)

**Player Management**
- Opponent profiles identified by email address
- Explicit invitation system (preventing unsolicited emails)
- Players can access matches involving them after sign-in

### MVP Requirements

The minimum viable product includes three core functions:
1. Email-based authentication via magic links
2. Match score recording against opponents (requiring name and email)
3. A chronological list view supporting both mobile and desktop interfaces

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
