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

**Frontend (src/):**
```
src/
├── app/
│   ├── page.tsx                # Landing page with "Get Started" CTA
│   ├── layout.tsx              # Root layout with Geist fonts
│   ├── globals.css             # Theme variables (zinc palette, dark mode)
│   ├── login/
│   │   ├── page.tsx            # Email input for sign-in
│   │   └── check-email/
│   │       └── page.tsx        # "Check your email" confirmation
│   ├── complete-profile/
│   │   └── page.tsx            # Post-signup name entry (outside route group)
│   └── (app)/                  # Route group — shared layout for authenticated pages
│       ├── layout.tsx          # Wraps children with UserProvider + Nav + gradient
│       ├── nav.tsx             # Shared nav bar (logo + user avatar)
│       ├── feed/
│       │   ├── page.tsx        # Match feed with "Log Match" CTA
│       │   ├── match-card.tsx  # Clickable match card (links to detail)
│       │   └── [id]/
│       │       └── page.tsx    # Match detail (view, edit, delete)
│       ├── log-match/
│       │   └── page.tsx        # Match logging form
│       └── profile/
│           └── page.tsx        # Profile page (name, email, sign out)
├── contexts/
│   └── user-context.tsx        # UserProvider + useUser hook (fetches user, sign-out)
├── lib/
│   └── user.ts                 # Shared helpers (getInitials)
├── types/
│   ├── match.ts                # Match, Game, Opponent types
│   └── user.ts                 # User type
└── middleware.ts                # Route protection (redirect logged-out users)
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
- Dev-mode auto-login (`POST /api/auth/dev-login`, gated behind `IsDevelopment()`)
- Frontend match feed display with loading skeletons, empty state, and cursor-based pagination
- Seed data script (`backend/seed-data.sh`)
- Per-user match notes (creator and opponent each have private notes, resolved via `PUT /api/matches/{id}/notes`)
- Frontend match logging form with inline opponent creation
- Shared nav bar and (app) route group for authenticated pages
- Profile page (name, email, member since, sign out)
- UserContext for centralized user state and sign-out logic
- Match detail page with view, inline edit, and delete (confirmation modal)

### Not Yet Implemented
- Frontend opponent management UI

### Ideas to Explore
- **Remotion demo video:** Use Remotion (React-based video framework) with Claude Code prompting to create a programmatic demo video of GameLogger

## MVP Requirements (from spec)

1. Email-based authentication via magic links
2. Match score recording (opponent name + email, best of 3/5, game scores, notes)
3. Chronological match feed (mobile + desktop)
