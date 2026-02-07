# GameLogger

A squash match tracking app. See README.md for full specification.

## Working Style

The developer is new to web development and is using this project to learn. When making changes:
- Explain what you're doing and why
- Introduce new concepts (frameworks, patterns, tools) when they come up
- Keep explanations concise but clear

## Tech Stack

**Frontend:**
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel at https://gamelogger.app
- **Testing:** Playwright (E2E tests)

**Backend:**
- **Language:** Go 1.22
- **Router:** chi
- **Database:** PostgreSQL (via pgx)
- **Email:** Resend
- **Deployment:** Railway
- **Testing:** Go testing + testify

## Commands

**Frontend:**
- `npm run dev` - Start frontend at localhost:3000
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npx playwright test` - Run E2E tests

**Backend (from /backend directory):**
- `make dev` - Start backend at localhost:8080 (also starts PostgreSQL)
- `make test` - Run unit tests
- `make test-int` - Run integration tests
- `make migrate-up` - Run database migrations
- `make db` - Start PostgreSQL container

## Project Structure

**Frontend (src/app/):**
```
src/app/
├── page.tsx                    # Landing page with "Get Started" CTA
├── login/
│   ├── page.tsx                # Email input for sign-in
│   └── check-email/
│       └── page.tsx            # "Check your email" confirmation
├── feed/
│   └── page.tsx                # Home feed (empty state)
├── layout.tsx                  # Root layout with Geist fonts
└── globals.css                 # Theme variables (zinc palette, dark mode)
```

**Backend (backend/):**
```
backend/
├── cmd/server/main.go          # Entry point
├── internal/
│   ├── config/                 # Environment config
│   ├── database/               # DB connection + migrations
│   ├── handlers/               # HTTP handlers
│   ├── models/                 # Data structures
│   ├── services/               # Business logic (email, etc.)
│   └── repository/             # Database queries
├── testutil/                   # Test helpers
├── docker-compose.yml          # Local PostgreSQL
├── Makefile                    # Dev commands
└── .env.example                # Environment template
```

## Design System

- **Colors:** Zinc palette throughout (zinc-50 to zinc-950)
- **Dark mode:** Automatic via `prefers-color-scheme`, use `dark:` prefix
- **Typography:** Geist Sans font family
- **Layout:** Centered content with `max-w-md` or `max-w-2xl`
- **Buttons:** Rounded-full or rounded-lg, zinc-900 bg with zinc-50 in dark mode

## Current Status

### Completed
- Landing page with feature list
- Sign-in flow UI (email input → check email → feed)
- Responsive and dark mode ready
- Playwright integration tests for sign-in flow
- Backend auth (magic links, sessions, logout) — fully working
- Backend match CRUD API with squash scoring validation
- Backend opponent CRUD API
- Database schema (users, sessions, magic_links, matches, games, opponents)
- Route protection middleware (frontend)
- Railway deployment (backend)
- Vercel deployment (frontend)

### Not Yet Implemented
- Frontend match logging form
- Frontend match feed display
- Frontend opponent management UI
- Frontend match detail/edit/delete views

### Ideas to Explore
- **Remotion demo video:** Use Remotion (React-based video framework) with Claude Code prompting to create a programmatic demo video of GameLogger

## MVP Requirements (from spec)

1. Email-based authentication via magic links
2. Match score recording (opponent name + email, best of 3/5, game scores, notes)
3. Chronological match feed (mobile + desktop)
