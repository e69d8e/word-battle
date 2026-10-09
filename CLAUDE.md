# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Word Battle (单词大作战) is a Chinese-language English vocabulary PK game targeting Chinese users preparing for CET-4, CET-6, TOEFL, and IELTS. Players compete against an AI opponent or other players in timed multiple-choice quizzes with three question types: English-to-Chinese, Chinese-to-English, and Listening.

**Tech stack:** Next.js 16.2.6 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4 + Prisma 6 (PostgreSQL/Supabase) + Zustand 5 + Supabase Realtime + Electron 42.

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
- **Web:** Deployed on Netlify with `@netlify/plugin-nextjs` — `netlify.toml` runs `node scripts/download-audio.js` before `npm run build` to pre-fetch pronunciation audio
- **Desktop:** Electron wrapper — `electron/main.ts` loads `localhost:3000` in dev or `../out/index.html` in production. Uses `electron-builder` with DMG/NSIS/AppImage targets (icon: `public/icon.png`)
- **Database:** Supabase PostgreSQL (cloud-hosted)
- **Realtime:** Supabase Realtime channels (replaces Socket.io)

### Frontend (all client components with "use client")
- **State management:** Zustand stores in `src/stores/` — `authStore.ts` (user auth via localStorage) and `gameStore.ts` (game state machine with scoring logic, in-memory only)
- **Game flow:** Mode selection → word loading from API → 10 random questions (15s timer each) → scoring → results → save to DB
- **Game modes** (`GameMode = "ai" | "realtime" | "async"`):
  - **AI mode:** Simulated opponent with ~70% accuracy and random response delays
  - **Realtime mode:** Supabase Realtime channels for multiplayer (create/join rooms, real-time synchronization)
  - **Async mode:** Type exists for future play-by-mail mode
- **UI components:** Custom components in `src/components/ui/` (`button`, `card`, `input`, `badge`, `progress`, `dialog`) — no external UI library. Use `React.forwardRef` pattern with `cn()` for className merging
- **Path alias:** `@/*` maps to `./src/*`
- **Live Demo:** The landing page (`src/app/page.tsx`) embeds an interactive demo question carousel with sound + scoring animations for unauthenticated visitors

### Backend (Next.js API Route Handlers in `src/app/api/`)
All handlers use shared helpers `apiSuccess()` / `apiError()` from `src/lib/api.ts` (wraps `NextResponse.json`):
- **Auth:** `/api/auth/register` (POST, bcrypt), `/api/auth/login` (POST, bcrypt compare), `/api/auth/me` (GET by localStorage ID)
- **Game:** `/api/game` (POST saves `Game` + cascading `GameQuestion` rows + per-player `Score` rows; GET lists games for a userId with optional mode filter)
- **Words:** `/api/words?level=CET4` — serves from in-memory JSON (`src/data/words/{level}.json`); on first request seeds `WordList`/`Word` rows into the DB if missing. Response is `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`; on DB failure falls back to JSON with shorter TTL
- **Leaderboard:** `/api/leaderboard?mode=&level=&limit=` — uses Prisma `groupBy` to compute per-user max score, then joins `user` for username. Returns `{ rank, userId, username, score }[]`
- **Rooms:** `/api/rooms` (POST, allocate a code), `/api/rooms/join` (POST, claim the second seat), `/api/rooms/leave` (POST, release/close), `/api/rooms/start` (POST, mark playing + extend TTL). Helpers in `src/lib/rooms.ts`; all require a session and never expose player ids (`toPublicRoom`).

### Realtime Multiplayer (Supabase Realtime)
Uses Supabase Realtime channels (`src/lib/supabase.ts` — client-only, returns `null` on the server). Wire protocol + pure join/capacity decisions live in `src/lib/realtime-protocol.ts` (unit-tested, `realtime-protocol.test.ts`):
- **Room registry (server-owned):** `POST /api/rooms` allocates a unique 6-character code (unambiguous alphabet, `Room` table, 30-min TTL); `POST /api/rooms/join` claims the second seat with a conditional update; `POST /api/rooms/leave` frees/closes it (also called via `navigator.sendBeacon` on pagehide); `POST /api/rooms/start` extends the reservation when the match begins. The realtime handshake still runs afterwards as defence in depth.
- **Two topics per room:** `room:{id}` (lobby) and `room:{id}:play` (the match) — kept apart so the lobby's presence teardown during the hand-off is not mistaken for the opponent leaving.
- **Game synchronization:** Real-time answer submission, score updates, question progression via broadcast events
- **Events:** lobby — `room-update`, `request-state`, `room-full`, `game-started`, `player-left`; match — `answer-submitted`, `player-finished`, `game-state`/`request-game-state`, `game-ended`, `rematch-requested`, `player-left`
- **Host authority:** `players[0]` is the host — it alone answers `request-state`, alone starts/restarts the match, and alone POSTs the finished game (a non-host client must not save, or every match is stored twice).
- **Liveness:** presence requires an opt-in — `subscribe()` enables it when `config.presence.enabled === true` **or** a presence binding was registered before `subscribe()` (which is why handlers must be attached before subscribing). The app does both and calls `track()` after SUBSCRIBE. A presence `leave` (10 s grace, so a reload can return) or an explicit `player-left` aborts an in-flight match and releases a stuck "waiting for opponent" overlay.
- **Resume after reload:** `src/lib/realtime-session.ts` snapshots the in-progress match to `sessionStorage`; the game page rehydrates it on mount and asks the peer for `game-state`, so a refresh no longer strands the opponent. Finished matches are not resumable.
- **Trust model:** living scores/combos come from local recomputation of the peer's answer map (`scoreForAnswer` / `recomputeFromAnswers`); `syncOpponentFinished` sanitizes ids/shapes and ignores the peer's claimed totals.
- **Lobby UX:** `src/app/(main)/lobby/page.tsx` handles create/join room flow, room status, rematch requests

### Database (Supabase PostgreSQL via Prisma)
Key models: User, WordList, Word, Game, GameQuestion, Score, Room. See `prisma/schema.prisma` for full schema.

> Migrations are a single squashed baseline (`prisma/migrations/20261009080000_init`), so the history replays cleanly on a fresh/shadow database and `prisma migrate dev` works normally. The baseline is generated with `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`; `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <scratch-db>` must report an empty migration (it did, which is how the baseline was verified).
>
> The baseline also appends hardening that Prisma does not model: RLS is enabled (no policies) on every app table and `anon`/`authenticated` table privileges are revoked, including the default privileges for future tables. Supabase grants those PostgREST roles full DML on anything created in `public`, and the anon key is public (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), which previously left `Game`/`Score`/`Word` readable **and writable** by anyone holding it — bypassing the API's score validation. The app reaches these tables only through Prisma as `postgres` (BYPASSRLS) and uses the anon key solely for Realtime, so this does not affect it. Keep the statements when regenerating the baseline.
- Connection via `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations)
- `GameQuestion.options` is stored as JSON string (serialized array of 4 options)
- `Score` has composite index on `(userId, mode, level)` for efficient leaderboard queries; `Score` is the data source for the leaderboard (one row per finished game)
- `Game` indexes on `player1Id`, `player2Id`, and `createdAt DESC` for history queries
- A local SQLite dev DB exists at `prisma/dev.db` for offline prototyping

### Auth model
Simple localStorage-based: user ID stored client-side, passed as query param to API routes. No JWT, no sessions, no middleware auth guards.

## File Layout

```
src/
  app/
    page.tsx                 # Landing page (hero + interactive Live Demo)
    layout.tsx               # Root layout: AuthProvider + Header + fonts
    globals.css              # Tailwind v4 @theme with design tokens
    (auth)/login/, register/ # Auth pages (route group, no layout)
    (main)/
      game/                  # Game page (mode selection + gameplay + realtime)
      lobby/                 # Realtime multiplayer lobby (Supabase Realtime)
      leaderboard/           # Leaderboard "Hall of Fame" with top-3 podium
      history/               # Game history with career stats + filters
    api/
      auth/                  # login, register, me (route folders)
      game/route.ts          # POST save, GET list (player1Id/player2Id/mode filters)
      words/route.ts         # GET by level, auto-seeds DB from JSON
      leaderboard/route.ts   # GET grouped high scores per user
  components/
    game/                    # GameResult, QuestionCard, ScoreBoard, Timer
    layout/                  # Header
    providers/               # AuthProvider (checkAuth on mount)
    auth/                    # AuthForm (shared login + register)
    ui/                      # Reusable UI primitives (button, card, input, badge, dialog)
  stores/                    # Zustand stores (authStore, gameStore)
  hooks/                     # useSpeech (audio fallback), useWords (level-cached fetch)
  lib/
    db.ts                    # Prisma singleton (prevents hot-reload connection exhaustion)
    supabase.ts              # Client-only Supabase client (null on server)
    api.ts                   # apiSuccess() / apiError() helpers for route handlers
    questions.ts             # generateQuestion() + generateQuestions() (mixes en2cn/cn2en/listening)
    sound.ts                 # Web Audio API sound engine (zero deps, localStorage preference)
    utils.ts                 # cn(), shuffleArray(), getRandomItems(), generateId()
    realtime-protocol.ts     # Room/play topics + pure join/capacity decisions (unit-tested)
    realtime-session.ts      # sessionStorage resume snapshot for an in-progress match
    rooms.ts                 # Room codes, TTL, public room shape (server-side reservations)
    auth.ts                  # Session cookie helpers (getSessionFromRequest)
    rate-limit.ts            # In-memory IP rate limiting for login/register
  types/                     # All TypeScript interfaces (User, WordItem, Question, GameState, GameResult, LeaderboardEntry)
  data/words/                # Word list JSON files (cet4.json, cet6.json, toefl.json, ielts.json)
prisma/
  schema.prisma              # Database schema (PostgreSQL)
  seed.ts                    # Database seeder
scripts/
  realtime-smoke.mjs         # npm run smoke:realtime — live transport checks
  db-restore.mjs             # npm run db:restore — restore a db-backup/*.json dump
  download-audio.js          # Download pronunciation audio from Youdao (runs in Netlify build)
  generate-words.js          # Generate word list JSONs
  import-dict.js             # Import dictionary data
electron/
  main.ts                    # Electron main process
next.config.ts               # allowedDevOrigins for LAN dev (Electron + mobile testing)
netlify.toml                 # Netlify config (download-audio.js before build)
.mcp.json                    # Supabase MCP server config (DB tools)
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
- API routes use `NextResponse.json()` via `apiSuccess()` / `apiError()` from `src/lib/api.ts` and parse input with `request.json()` / `nextUrl.searchParams`
- The Prisma client singleton is in `src/lib/db.ts` (prevents hot-reload connection exhaustion)
- Word data auto-seeds: the `/api/words` route checks if words exist for the requested level and seeds from JSON if empty
- Realtime multiplayer uses Supabase Realtime channels — see `src/lib/supabase.ts` for client configuration
- UI components use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for className merging
- The Supabase client (`src/lib/supabase.ts`) is client-side only — it returns `null` when run on the server
- `npm run postinstall` runs `prisma generate` automatically after `npm install`
- ESLint uses flat config (`eslint.config.mjs`), not `.eslintrc`
- An MCP server for Supabase is configured in `.mcp.json` — provides database tools via Claude Code (see `mcp__supabase__*` tools)
- Question generation is centralized in `src/lib/questions.ts` — both client and server reuse `generateQuestion()` and `generateQuestions()`

## Interaction Features

- **Full keyboard control** in `QuestionCard`: `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` to pick options, `Space` to play pronunciation. Ignores keystrokes while typing in `<input>` / `<textarea>`
- **Sound system** (`src/lib/sound.ts`): zero-dependency Web Audio API engine with synthesized effects — `playClick`, `playCorrect` (two-note arpeggio), `playWrong`, `playCombo` (pitch scales with streak), `playCountdownTick`, `playGameStart`, `playVictory`, `playDefeat`. Preference persisted to `localStorage["word_battle_sound_enabled"]`; toggled via `word_battle_sound_toggle` `CustomEvent`
- **Live Demo** on the homepage — interactive carousel of demo questions with full feedback animations (sound, floating score, combo indicator) so unauthenticated visitors can experience the game before signing up
- **Wrong-question review** — `GameResult` has a filter for `all` / `wrong` / `correct` answers; each row shows the full word card (phonetic, meaning, example) and a re-play pronunciation button
- **Career stats** on the History page — total games, wins/losses/draws, win rate, max score computed via `useMemo`
- **Leaderboard "Hall of Fame"** — top-3 podium rendering with mode + level filter chips
- **Battle report copy** — `GameResult` formats a shareable Chinese battle summary to the clipboard via `navigator.clipboard.writeText`

## Scoring (in `src/stores/gameStore.ts`)

Per-question, per-player (player 1 vs player 2):
- **Base:** 100 if correct, 0 if wrong
- **Time bonus:** `floor((15000 - timeMs) / 100)` — caps at 50 for instant answers, 0 if time runs out
- **Combo bonus:** `(nextCombo - 1) * 10` capped at 50, awarded only when the new combo ≥ 2 (i.e., the player is on at least a 2-streak)
- **Wrong answer resets combo to 0** for that player
- Per-player `combo` and `maxCombo` tracked separately; `submitAnswer` guards against double-submission for the same question ID

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

`src/stores/gameStore.ts` manages the game lifecycle (in-memory Zustand store, no persistence):
- **Status transitions:** `waiting` → `playing` → `finished`
- **Actions:** `initGame`, `submitAnswer(player, answer, timeMs)`, `nextQuestion`, `finishGame`, `resetGame`, `setGameStatus`, `updateScore`
- **`initGame(mode, wordLevel, words, totalQ?, presetQuestions?)`** — accepts optional `presetQuestions` so the realtime lobby can sync identical question sets between players (see `src/lib/questions.ts`)
- **Question generation:** Random mix of `en2cn`, `cn2en`, `listening` types from loaded word pool; per-question options deduped and padded to 4 if the pool is small
- **AI opponent:** Simulated with ~70% accuracy and random response delays in `src/app/(main)/game/page.tsx`

## Realtime Protocol

Two Supabase Realtime topics per room: `room:{roomId}` while in the lobby, `room:{roomId}:play` during the match. Constants and the pure join/capacity decisions live in `src/lib/realtime-protocol.ts`.

Server-side room registry (`Room` table): the code is allocated by `POST /api/rooms`, the second seat claimed by `POST /api/rooms/join` (conditional update), released by `POST /api/rooms/leave`, and extended by `POST /api/rooms/start`. A full/expired/unknown room is therefore rejected by the API *before* any channel work; the lobby broadcast handshake below is the second line of defence.

Lobby (`room:{roomId}`):
- `room-update` — lobby state changes (player joined/left/ready); the joiner keeps re-sending `request-state` until the host acknowledges it by including it in a `room-update`
- `request-state` — joiner asks the host for the current room; **only the host (`players[0]`) replies**
- `room-full` — host → joiner rejection when the room already has 2 players; carries `senderId` so the host and the sitting opponent ignore it (the channel uses `broadcast: { self: true }`, which echoes the sender's own messages)
- `game-started` — host → joiner hand-off, payload `{ questions, totalQuestions, wordLevel }`
- `player-left` — payload `{ room, username, playerId }`

Match (`room:{roomId}:play`):
- `answer-submitted` — payload `{ playerId, username, questionId, answer, timeMs, isCorrect }`
- `player-finished` — payload `{ playerId, username, finalScore, maxCombo, answers }`; `finalScore`/`maxCombo` are advisory only — the receiver recomputes from `answers`
- `request-game-state` / `game-state` — sent on (re)subscribe so a reloaded client catches up on answers it missed; payload `{ playerId, username, answers, finished }`
- `game-ended` — payload `{ playerId, score }`
- `rematch-requested` — payload `{ playerId }`
- `player-left` — payload `{ playerId, username }`

Presence is used for liveness on both topics. `RealtimeChannel.subscribe()` enables presence in the join payload when `config.presence.enabled === true` **or** a presence binding was registered before subscribing — a channel with neither never observes presence. On top of that, `channel.track()` is what publishes your own state, and adding a presence binding *after* `subscribe()` throws. So the app does all three: enable it in the config, register presence handlers before `subscribe()`, and `track()` on `SUBSCRIBED`. Verified by `npm run smoke:realtime`.

Only the host POSTs the finished match to `/api/game` (see `isHostRef` in `src/app/(main)/game/page.tsx`); the joiner's client would otherwise create a second `Game` row for the same match.

### Resume after reload

The game state lives in memory, so a refresh used to drop the player back to the mode picker while their opponent waited. `src/lib/realtime-session.ts` stores a validated snapshot in `sessionStorage` (room id, questions, index, scores, answers, host flag, self-finished) keyed per room:
- the game page writes it on every store change while the match is playing and drops it when the match finishes or the page unmounts (a real page unload does not run cleanup, so reloads resume)
- on mount it rehydrates the snapshot, restores refs, resumes the pending question advance, and re-sends `player-finished` if the local player had finished
- the peer answers `request-game-state` with `game-state`, so missed answers are recovered
- presence leave waits 10 s before aborting, and a presence `join` cancels a pending abort — enough for a reloading tab to come back

## Utility Scripts

Located in `scripts/`:
- `realtime-smoke.mjs` — **`npm run smoke:realtime`**: checks the live Supabase project for the transport behaviour the multiplayer flow assumes (broadcast both ways, presence opt-in + `leave`, lobby→match hand-off isolation, play-topic traffic, `self: true` echo). Read-only, needs `.env` credentials, exits non-zero on failure
- `db-restore.mjs` — **`npm run db:restore [file]`**: restores a `db-backup/*.json` dump into the database (User → Game → GameQuestion → Score, ids preserved, `skipDuplicates` so it is safe to re-run, `GameQuestion.wordId` remapped by level+text, password hashes copied verbatim so original passwords keep working)
- `generate-words.js` — Generate word list JSON files from dictionary sources
- `download-audio.js` — Download pronunciation audio files from Youdao API
- `import-dict.js` — Import dictionary data into word lists
