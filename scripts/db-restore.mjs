#!/usr/bin/env node
/**
 * Restore a database dump produced by the backup step (see README/CLAUDE).
 *
 * Usage:
 *   npm run db:restore                 # newest file in db-backup/
 *   npm run db:restore -- db-backup/word-battle-2026-10-09T07-45-27.json
 *
 * Behaviour and safety:
 *   - Restores User -> Game -> GameQuestion -> Score, preserving ids so foreign
 *     keys (and therefore match history) stay consistent.
 *   - WordList/Word are NOT restored: they are re-seeded identically by
 *     `npm run db:seed`. GameQuestion carries no word reference (see
 *     schema.prisma), so snapshots of older schemas lose only that link.
 *   - Existing rows are skipped (`skipDuplicates`), so re-running is safe and it
 *     can also be used to top up a partially restored database.
 *   - Password hashes are copied verbatim, so the original passwords keep working.
 */
import { PrismaClient } from "@prisma/client"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const prisma = new PrismaClient()
const BACKUP_DIR = "db-backup"

function resolveBackupFile() {
  const explicit = process.argv[2]
  if (explicit) return explicit
  if (!existsSync(BACKUP_DIR)) {
    throw new Error(`no ${BACKUP_DIR}/ directory — pass a backup file path explicitly`)
  }
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("word-battle-") && f.endsWith(".json"))
    .sort()
  if (files.length === 0) throw new Error(`no dump found in ${BACKUP_DIR}/`)
  return join(BACKUP_DIR, files[files.length - 1])
}

const date = (value) => (value ? new Date(value) : null)
const round = (value) => (value === null || value === undefined ? null : Math.round(Number(value)))

async function main() {
  const file = resolveBackupFile()
  const dump = JSON.parse(readFileSync(file, "utf8"))
  const T = dump.tables
  console.log(`Restoring ${file}\n  dumped at ${dump.createdAt}\n`)

  // ---------------------------------------------------------------- users
  const users = await prisma.user.createMany({
    data: T.User.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      avatar: u.avatar ?? null,
      createdAt: date(u.createdAt),
    })),
    skipDuplicates: true,
  })

  // ---------------------------------------------------------------- games
  const userIds = new Set(T.User.map((u) => u.id))
  const games = await prisma.game.createMany({
    data: T.Game.filter((g) => userIds.has(g.player1Id)).map((g) => ({
      id: g.id,
      clientId: g.clientId ?? null,
      mode: g.mode,
      status: g.status,
      wordLevel: g.wordLevel,
      player1Id: g.player1Id,
      player2Id: userIds.has(g.player2Id) ? g.player2Id : null,
      winnerId: userIds.has(g.winnerId) ? g.winnerId : null,
      score1: g.score1,
      score2: g.score2,
      totalQ: g.totalQ,
      createdAt: date(g.createdAt),
      finishedAt: date(g.finishedAt),
    })),
    skipDuplicates: true,
  })

  // -------------------------------------------------------- game questions
  const gameIds = new Set(
    (
      await prisma.game.findMany({ where: { id: { in: T.Game.map((g) => g.id) } }, select: { id: true } })
    ).map((g) => g.id)
  )
  const restoredQuestions = T.GameQuestion.filter((q) => gameIds.has(q.gameId))
  const questions = await prisma.gameQuestion.createMany({
    data: restoredQuestions.map((q) => ({
      id: q.id,
      gameId: q.gameId,
      type: q.type,
      options: q.options,
      answer1: q.answer1 ?? null,
      answer2: q.answer2 ?? null,
      correct1: q.correct1 ?? false,
      correct2: q.correct2 ?? false,
      time1: round(q.time1),
      time2: round(q.time2),
    })),
    skipDuplicates: true,
  })

  // ---------------------------------------------------------------- scores
  const scores = await prisma.score.createMany({
    data: T.Score.filter((s) => userIds.has(s.userId)).map((s) => ({
      id: s.id,
      userId: s.userId,
      mode: s.mode,
      level: s.level,
      score: s.score,
      createdAt: date(s.createdAt),
    })),
    skipDuplicates: true,
  })

  console.log("Inserted (existing rows skipped):")
  console.log(`  users         +${users.count} / ${T.User.length}`)
  console.log(`  games         +${games.count} / ${T.Game.length}`)
  console.log(`  gameQuestions +${questions.count} / ${T.GameQuestion.length}`)
  console.log(`  scores        +${scores.count} / ${T.Score.length}`)

  // ---------------------------------------------------------------- verify
  const stored = await prisma.user.findMany({
    where: { username: { in: T.User.map((u) => u.username) } },
    select: { username: true, password: true },
  })
  const hashByUser = new Map(stored.map((u) => [u.username, u.password]))
  const hashesOk = T.User.every((u) => hashByUser.get(u.username) === u.password)
  console.log(`\nPassword hashes intact (original passwords still valid): ${hashesOk ? "yes" : "NO"}`)
  console.log(
    `Totals -> users:${await prisma.user.count()} games:${await prisma.game.count()} ` +
      `questions:${await prisma.gameQuestion.count()} scores:${await prisma.score.count()} words:${await prisma.word.count()}`
  )
  if (!hashesOk) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("restore failed:", error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
