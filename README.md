# GameLogger

A web-based squash match tracker designed to help users log friendly matches with friends, track scores, and maintain match history.

**Live:** https://gamelogger.app

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (React)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Deployment:** [Vercel](https://vercel.com)

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
- Final score logging with notes
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
