# CLAUDE.md

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
- **Web:** Deployed on Netlify with `@netlify/plugin-nextjs` — build command runs `download-audio.js` first
- **Desktop:** Electron wrapper — `electron/main.ts` loads `localhost:3000` in dev or `../out/index.html` in production. Uses `electron-builder` with DMG/NSIS/AppImage targets
- **Database:** Supabase PostgreSQL (cloud-hosted)
- **Realtime:** Supabase Realtime channels (replaces Socket.io)

### Frontend (all client components with "use client")
- **State management:** Zustand stores in `src/stores/` — `authStore.ts` (user auth via localStorage) and `gameStore.ts` (game state machine with scoring logic)
- **Game flow:** Mode selection → word loading from API → 10 random questions (15s timer each) → scoring (100 base + up to 50 time bonus) → results → save to DB
- **Game modes:**
  - **AI mode:** Simulated opponent with ~70% accuracy and random response delays
  - **Realtime mode:** Supabase Realtime channels for multiplayer (create/join rooms, real-time synchronization)
- **UI components:** Custom components in `src/components/ui/` — no external UI library. Use `React.forwardRef` pattern with `cn()` for className merging
- **Path alias:** `@/*` maps to `./src/*`

### Backend (Next.js API Route Handlers in `src/app/api/`)
- **Auth:** `/api/auth/register` (POST, bcrypt), `/api/auth/login` (POST, bcrypt compare), `/api/auth/me` (GET by localStorage ID)
- **Game:** `/api/game` (POST to save, GET to list)
- **Words:** `/api/words?level=CET4` — auto-seeds from `src/data/words/{level}.json` on first request if level doesn't exist in DB
- **Leaderboard:** `/api/leaderboard` (GET, grouped high scores)

### Realtime Multiplayer (Supabase Realtime)
Uses Supabase Realtime channels (`src/lib/supabase.ts`):
- **Room system:** Create/join rooms with unique room IDs (channel name: `room:{id}`)
- **Game synchronization:** Real-time answer submission, score updates, question progression via broadcast events
- **Events:** `room-update`, `game-start`, `game-started`, `player-left`

### Database (Supabase PostgreSQL via Prisma)
Key models: User, WordList, Word, Game, GameQuestion, Score. See `prisma/schema.prisma` for full schema.
- Connection via `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations)
- `GameQuestion.options` is stored as JSON string (serialized array of 4 options)
- `Score` has composite index on `(userId, mode, level)` for efficient leaderboard queries

### Auth model
Simple localStorage-based: user ID stored client-side, passed as query param to API routes. No JWT, no sessions, no middleware auth guards.

## File Layout

```
src/
  app/
    page.tsx                 # Landing page (hero + features)
    layout.tsx               # Root layout: AuthProvider + Header + fonts
    globals.css              # Tailwind v4 @theme with design tokens
    (auth)/login/, register/ # Auth pages (route group, no layout)
    (main)/
      game/                  # Game page (mode selection + gameplay + realtime)
      lobby/                 # Realtime multiplayer lobby (Supabase Realtime)
      leaderboard/           # Global leaderboard
      history/               # Game history page
    api/                     # All API route handlers (auth, game, words, leaderboard)
  components/
    game/                    # GameResult, QuestionCard, ScoreBoard, Timer
    layout/                  # Header
    providers/               # AuthProvider (checkAuth on mount)
    ui/                      # Reusable UI primitives (button, card, input, badge, progress, dialog)
  stores/                    # Zustand stores (authStore, gameStore)
  hooks/                     # useSpeech (audio fallback), useTimer (rAF-based)
  lib/                       # db.ts (Prisma singleton), supabase.ts (client-only), utils.ts (cn, shuffle)
  types/                     # All TypeScript interfaces
  data/words/                # Word list JSON files (cet4.json, cet6.json, toefl.json, ielts.json)
prisma/
  schema.prisma              # Database schema (PostgreSQL)
  seed.ts                    # Database seeder
scripts/
  download-audio.js          # Download pronunciation audio from Youdao
  generate-words.js          # Generate word list JSONs
  import-dict.js             # Import dictionary data
electron/
  main.ts                    # Electron main process
netlify.toml                 # Netlify config (runs download-audio.js before build)
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
- UI components use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for className merging
- The Supabase client (`src/lib/supabase.ts`) is client-side only — it returns `null` when run on the server
- `npm run postinstall` runs `prisma generate` automatically after `npm install`
- ESLint uses flat config (`eslint.config.mjs`), not `.eslintrc`
- An MCP server for Supabase is configured in `.mcp.json` — provides database tools via Claude Code

## Design System

Warm editorial theme with cream/coral/navy palette defined in `src/app/globals.css` using Tailwind v4's `@theme` directive (not `tailwind.config`):
- **Colors:** `--color-primary` (coral #cc785c), `--color-canvas` (cream #faf9f5), `--color-surface-dark` (navy #181715)
- **Typography:** `--font-display` (Cormorant Garamond serif for headlines), `--font-body` (Inter sans-serif)
- **Semantic colors:** `--color-success`, `--color-error`, `--color-warning` for game feedback
- Custom Tailwind classes: `bg-canvas`, `text-body`, `text-ink`, `bg-surface-soft`, `border-hairline`, etc.

## Audio System

Pronunciation uses a two-tier fallback in `src/hooks/useSpeech.ts`:
1. **Local files:** `/public/audio/{word}.mp3` — downloaded via `scripts/download-audio.js`
2. **Online fallback:** Youdao Dictionary API (`https://dict.youdao.com/dictvoice`)

The Netlify build runs `node scripts/download-audio.js` before `npm run build` to pre-download audio files.

## Game State Machine

`src/stores/gameStore.ts` manages the game lifecycle:
- **Status transitions:** `waiting` → `playing` → `finished`
- **Scoring:** 100 base points per correct answer + time bonus (up to 50 points for fast answers within 15s)
- **Question generation:** Random mix of `en2cn`, `cn2en`, `listening` types from loaded word pool
- **AI opponent:** Simulated with ~70% accuracy and random response delays

## Realtime Protocol

Supabase Realtime channel events (channel name: `room:{roomId}`):
- `answer-submitted` — payload: `{ answer, correct, time, score, username }`
- `player-finished` — payload: `{ username, finalScore, correctCount }`
- `game-ended` — payload: `{ winner, finalScores }`
- `room-update` — lobby state changes (player joined/left)

## Utility Scripts

Located in `scripts/`:
- `generate-words.js` — Generate word list JSON files from dictionary sources
- `download-audio.js` — Download pronunciation audio files from Youdao API
- `import-dict.js` — Import dictionary data into word lists
