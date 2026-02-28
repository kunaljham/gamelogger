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

## AI-Assisted Code Review with Claude Code Subagents

This project uses [Claude Code](https://docs.anthropic.com/en/docs/claude-code) as the primary development tool, with a multi-agent code review workflow configured in `.claude/CLAUDE.md`. The workflow runs four specialized subagents before every commit to catch issues that would otherwise slip through.

### The subagents

| Agent | What it does |
|-------|-------------|
| **qa-tester** | Runs the test suite, build, and linter. Flags coverage gaps and test failures. |
| **sre** | Audits for N+1 queries, missing or redundant database indexes, slow query patterns, transaction scope issues, and frontend bundle size. |
| **code-reviewer** | Reviews for simplicity, maintainability, correctness, and dead code. Catches unused methods, redundant abstractions, and stale references. |
| **security** | Audits for injection flaws, auth bypass, IDOR, XSS, CSRF, missing input validation, secrets exposure, and insecure defaults. |

The qa-tester runs first. If it passes, the other three run in parallel. This ordering ensures that tests and builds pass before spending time on deeper analysis.

### Why this setup

The project is a learning exercise in full-stack development, so having automated reviewers catch mistakes before they're committed has been genuinely valuable. The subagents have caught real issues — missing database indexes, dead code left behind after refactors, N+1 query patterns, and input validation gaps — that would have been easy to miss in manual review. Having these checks in the development loop means issues are caught and fixed in context, while the code is still fresh.

### The iteration loop

The key design choice is that fixing subagent-reported issues triggers another round of review. Fixes themselves are non-trivial changes: replacing a method with a batched version can leave the old method as dead code; consolidating two indexes can make an older index redundant. The agents re-run after every round of fixes until all four report no actionable issues. Only then is the commit made.

This iterative loop has been one of the more productive aspects of the workflow. It means a single feature commit arrives with its performance optimizations, dead code cleanup, and security hardening already applied — rather than accumulating tech debt that needs a separate cleanup pass.

### Honest experience: what works and what doesn't

**Time cost is real.** Running four subagents takes time — often longer than the code change itself. For a small feature that takes a few minutes to implement, the review cycle can take significantly longer as agents spin up, analyze, and report back. You have to think about how to use that wait time effectively (reviewing the change yourself, planning the next task, writing documentation).

**Reliability has been a challenge.** The subagents have not been robust enough in triggering automatically on every qualifying change. Despite clear instructions in `CLAUDE.md` that all four agents must run before committing, Claude Code has frequently skipped them or only run a subset. This has required repeatedly questioning Claude Code about why the agents weren't run and finding ways to make the instructions more explicit and harder to ignore. On many occasions the agents have had to be manually triggered by asking Claude Code directly to run them. The `CLAUDE.md` instructions have been refined multiple times to try to make the agents run consistently — adding explicit notes about when to skip (only trivial changes), emphasizing that fixes require re-running, and spelling out that all four must pass.

This is worth being aware of if you're setting up a similar workflow: the instructions work, but they require active enforcement. Treat the `CLAUDE.md` configuration as a living document that you'll need to tighten based on what you observe Claude Code actually doing.

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
