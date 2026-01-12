# GameLogger

A squash match tracking app. See README.md for full specification.

## Working Style

The developer is new to web development and is using this project to learn. When making changes:
- Explain what you're doing and why
- Introduce new concepts (frameworks, patterns, tools) when they come up
- Keep explanations concise but clear

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel at https://gamelogger.app

## Commands

- `npm run dev` - Start dev server at localhost:3000
- `npm run build` - Production build
- `npm run lint` - Run ESLint

## Project Structure

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
- Dev button to simulate sign-in link click

### Not Yet Implemented
- Backend authentication (magic link emails)
- Database for users and matches
- Match logging form
- Match feed display
- Opponent invitations

## MVP Requirements (from spec)

1. Email-based authentication via magic links
2. Match score recording (opponent name + email, best of 3/5, game scores, notes)
3. Chronological match feed (mobile + desktop)
