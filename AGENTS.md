# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Word Battle (单词大作战) is a Chinese-language English vocabulary PK game targeting Chinese users preparing for CET-4, CET-6, TOEFL, and IELTS. Players compete against an AI opponent or other players in timed multiple-choice quizzes with three question types: English-to-Chinese, Chinese-to-English, and Listening.

**Tech stack:** Next.js 16.2.6 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4 + Prisma (PostgreSQL/Supabase) + Zustand + Supabase Realtime + Electron 42.

**Important:** This Next.js version has breaking changes from older versions. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` — especially `01-app/` for App Router patterns.

## Commands

```bash
# Development
npm run dev              # Next.js dev server at localhost:3000
npm run electron-dev     # Dev with Electron wrapper (runs Next.js + Electron concurrently)

# Production
npm run build            # Prisma generate + Next.js production build
npm run electron-build   # Build desktop app (Next.js build + electron-builder)

# Linting
npm run lint             # ESLint (flat config: next/core-web-vitals + next/typescript)

# Database (Prisma + Supabase PostgreSQL)
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Create and apply migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run db:seed          # Seed database from prisma/seed.ts
```

No test framework is configured. The Next.js docs at `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` cover Vitest setup if tests are added.

## Architecture

### Deployment
- **Web:** Deployed on Netlify with `@netlify/plugin-nextjs`
- **Desktop:** Electron wrapper — `electron/main.ts` loads `localhost:3000` in dev or `../out/index.html` in production
- **Database:** Supabase PostgreSQL (cloud-hosted)
- **Realtime:** Supabase Realtime channels (replaces Socket.io)

### Frontend (all client components with "use client")
- **State management:** Zustand stores in `src/stores/` — `authStore.ts` (user auth via localStorage) and `gameStore.ts` (game state machine with scoring logic)
- **Game flow:** Mode selection → word loading from API → 10 random questions (15s timer each) → scoring (100 base + up to 50 time bonus) → results → save to DB
- **Game modes:**
  - **AI mode:** Simulated opponent with ~70% accuracy and random response delays
  - **Realtime mode:** Supabase Realtime channels for multiplayer (create/join rooms, real-time synchronization)
- **UI components:** Custom components in `src/components/ui/` (button, card, input, badge, progress) — no external UI library
- **Path alias:** `@/*` maps to `./src/*`

### Backend (Next.js API Route Handlers in `src/app/api/`)
- **Auth:** `/api/auth/register` (POST, bcrypt), `/api/auth/login` (POST, bcrypt compare), `/api/auth/me` (GET by localStorage ID)
- **Game:** `/api/game` (POST to save, GET to list)
- **Words:** `/api/words?level=CET4` — auto-seeds from `src/data/words/{level}.json` on first request if level doesn't exist in DB
- **Leaderboard:** `/api/leaderboard` (GET, grouped high scores)
- **Rooms:** `/api/rooms` (POST, allocate code), `/api/rooms/join`, `/api/rooms/leave`, `/api/rooms/start` — server-side lobby reservations

### Realtime Multiplayer (Supabase Realtime)
Uses Supabase Realtime channels (`src/lib/supabase.ts`):
- **Room registry:** codes are allocated server-side (`POST /api/rooms`, `Room` table, 6 chars, 30-min TTL) and the second seat is claimed atomically (`POST /api/rooms/join`); `leave`/`start` release and extend it. Client-side `Math.random()` codes are gone.
- **Two topics per room:** `room:{id}` (lobby handshake) and `room:{id}:play` (the match), so the lobby's presence teardown during the hand-off is not mistaken for the opponent leaving.
- **Game synchronization:** Real-time answer submission, score updates, question progression via broadcast events
- **Events:** `room-update`, `request-state`, `room-full`, `game-started`, `player-left`, `answer-submitted`, `player-finished`, `request-game-state`/`game-state`, `game-ended`, `rematch-requested`
- **Host authority:** `players[0]` is the host — it alone answers `request-state`, alone starts the match, and alone persists the finished game.
- **Liveness + resume:** presence (`enabled: true` + pre-subscribe handlers + `track()`) detects a dropped peer; a reload resumes from a `sessionStorage` snapshot (`src/lib/realtime-session.ts`) and re-syncs with `game-state`.
- **Peer data is untrusted:** scores/combos are recomputed locally from the answer map (`scoreForAnswer` / `recomputeFromAnswers` in `gameStore.ts`); a peer's claimed `finalScore` is ignored.
- **Verification:** `npm run smoke:realtime` checks the live project for the transport behaviour the flow assumes (broadcast both ways, presence opt-in + `leave`, hand-off isolation, play-topic traffic, `self: true` echo).

### Database (Supabase PostgreSQL via Prisma)
Key models: User, WordList, Word, Game, GameQuestion, Score. See `prisma/schema.prisma` for full schema.
- Connection via `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations)

### Auth model
JWT session in an httpOnly cookie (`wb_session`, signed with `AUTH_SECRET` via `jose`):
- `/api/auth/login` and `/api/auth/register` set the session cookie; `/api/auth/logout` clears it
- `/api/auth/me`, `GET/POST /api/game` derive identity from the cookie via `getSessionFromRequest()` (`src/lib/auth.ts`) — client-supplied user ids are never trusted
- Score submissions are validated with zod (score ≤ questions × 200) and deduplicated via `Game.clientId`
- Login/register are IP rate-limited (`src/lib/rate-limit.ts`, in-memory — per-instance on serverless)
- localStorage only caches display data; it carries no identity

## File Layout

```
src/
  app/
    page.tsx                 # Landing page (hero + features)
    layout.tsx               # Root layout: AuthProvider + Header
    (auth)/login/, register/ # Auth pages (route group, no layout)
    (main)/
      game/                  # Game page (mode selection + gameplay)
      lobby/                 # Realtime multiplayer lobby (Supabase Realtime)
      leaderboard/           # Global leaderboard
      history/               # Game history page
    api/                     # All API route handlers
  components/
    game/                    # GameResult, QuestionCard, ScoreBoard, Timer
    layout/                  # Header
    providers/               # AuthProvider (checkAuth on mount)
    ui/                      # Reusable UI primitives
  stores/                    # Zustand stores (authStore, gameStore)
  hooks/                     # useSpeech (Web Speech API), useTimer (rAF-based)
  lib/                       # db.ts (Prisma singleton), supabase.ts (Supabase client), utils.ts
  types/                     # All TypeScript interfaces
  data/words/                # Word list JSON files (cet4.json, cet6.json, toefl.json, ielts.json)
prisma/
  schema.prisma              # Database schema (PostgreSQL)
  seed.ts                    # Database seeder
electron/
  main.ts                    # Electron main process
netlify.toml                 # Netlify deployment configuration
.env.example                 # Environment variables template
```

## Environment Variables

```bash
DATABASE_URL=postgresql://...           # Supabase pooled connection string
DIRECT_URL=postgresql://...             # Supabase direct connection string (for migrations)
NEXT_PUBLIC_SUPABASE_URL=...            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # Supabase anonymous key
```

## Key Patterns

- All page components use `"use client"` — there are no server components in the app currently
- API routes use `NextResponse.json()` for responses and `request.json()` / `nextUrl.searchParams` for input
- The Prisma client singleton is in `src/lib/db.ts` (prevents hot-reload connection exhaustion)
- Word data auto-seeds: the `/api/words` route checks if words exist for the requested level and seeds from JSON if empty
- Realtime multiplayer uses Supabase Realtime channels — see `src/lib/supabase.ts` for client configuration
