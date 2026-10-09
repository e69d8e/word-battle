import type { GameState, Question, WordLevel } from "@/types"
import { WORD_LEVELS } from "@/lib/realtime-protocol"

/**
 * Resume point for a realtime match, stored in sessionStorage.
 *
 * The game state lives in an in-memory Zustand store, so a refresh used to drop
 * the player straight back to the mode picker while the opponent kept waiting on
 * a match nobody was playing. A snapshot lets the reloaded page rejoin the same
 * room with the same questions, index and scores.
 *
 * Only realtime matches are snapshotted, and only while they are still being
 * played (a finished match is not resumable).
 */
export const REALTIME_SESSION_VERSION = 1
export const REALTIME_SESSION_TTL_MS = 30 * 60 * 1000
const KEY_PREFIX = "wb:realtime:"

export type AnswerMap = GameState["answers1"]

export interface RealtimeSessionSnapshot {
  version: number
  roomId: string
  savedAt: number
  isHost: boolean
  wordLevel: WordLevel
  questions: Question[]
  currentIndex: number
  score1: number
  score2: number
  combo1: number
  combo2: number
  maxCombo1: number
  maxCombo2: number
  lastScoreGained1: number
  lastScoreGained2: number
  answers1: AnswerMap
  answers2: AnswerMap
  opponentId: string
  opponentUsername: string
  selfFinished: boolean
}

export function realtimeSessionKey(roomId: string): string {
  return `${KEY_PREFIX}${roomId}`
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    return window.sessionStorage
  } catch {
    // Safari private mode & friends can throw on access
    return null
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isAnswerMap(value: unknown): value is AnswerMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (!entry || typeof entry !== "object") return false
    const answer = entry as Record<string, unknown>
    return (
      typeof answer.answer === "string" &&
      typeof answer.correct === "boolean" &&
      isFiniteNumber(answer.time)
    )
  })
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false
  const question = value as Record<string, unknown>
  return (
    typeof question.id === "string" &&
    typeof question.correctAnswer === "string" &&
    Array.isArray(question.options) &&
    question.options.every((option) => typeof option === "string") &&
    !!question.word &&
    typeof question.word === "object"
  )
}

/** Structural validation: sessionStorage is same-origin but not trustworthy. */
export function isRealtimeSessionSnapshot(value: unknown): value is RealtimeSessionSnapshot {
  if (!value || typeof value !== "object") return false
  const snapshot = value as Record<string, unknown>

  return (
    snapshot.version === REALTIME_SESSION_VERSION &&
    typeof snapshot.roomId === "string" &&
    snapshot.roomId.length > 0 &&
    isFiniteNumber(snapshot.savedAt) &&
    typeof snapshot.isHost === "boolean" &&
    typeof snapshot.wordLevel === "string" &&
    (WORD_LEVELS as readonly string[]).includes(snapshot.wordLevel) &&
    Array.isArray(snapshot.questions) &&
    snapshot.questions.length > 0 &&
    snapshot.questions.every(isQuestion) &&
    isFiniteNumber(snapshot.currentIndex) &&
    snapshot.currentIndex >= 0 &&
    snapshot.currentIndex < snapshot.questions.length &&
    isFiniteNumber(snapshot.score1) &&
    isFiniteNumber(snapshot.score2) &&
    isFiniteNumber(snapshot.combo1) &&
    isFiniteNumber(snapshot.combo2) &&
    isFiniteNumber(snapshot.maxCombo1) &&
    isFiniteNumber(snapshot.maxCombo2) &&
    isFiniteNumber(snapshot.lastScoreGained1) &&
    isFiniteNumber(snapshot.lastScoreGained2) &&
    isAnswerMap(snapshot.answers1) &&
    isAnswerMap(snapshot.answers2) &&
    typeof snapshot.opponentId === "string" &&
    typeof snapshot.opponentUsername === "string" &&
    typeof snapshot.selfFinished === "boolean"
  )
}

export function saveRealtimeSession(
  snapshot: Omit<RealtimeSessionSnapshot, "version">
): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(
      realtimeSessionKey(snapshot.roomId),
      JSON.stringify({ ...snapshot, version: REALTIME_SESSION_VERSION })
    )
    return true
  } catch {
    // Quota / disabled storage: resuming is a nice-to-have, never fatal
    return false
  }
}

export function loadRealtimeSession(
  roomId: string,
  now: number = Date.now()
): RealtimeSessionSnapshot | null {
  const store = storage()
  if (!store) return null

  let parsed: unknown
  try {
    const raw = store.getItem(realtimeSessionKey(roomId))
    if (!raw) return null
    parsed = JSON.parse(raw)
  } catch {
    clearRealtimeSession(roomId)
    return null
  }

  if (!isRealtimeSessionSnapshot(parsed) || parsed.roomId !== roomId) {
    clearRealtimeSession(roomId)
    return null
  }
  if (now - parsed.savedAt > REALTIME_SESSION_TTL_MS) {
    clearRealtimeSession(roomId)
    return null
  }
  return parsed
}

export function clearRealtimeSession(roomId: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(realtimeSessionKey(roomId))
  } catch {
    // ignore
  }
}
