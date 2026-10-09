import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  REALTIME_SESSION_TTL_MS,
  clearRealtimeSession,
  isRealtimeSessionSnapshot,
  loadRealtimeSession,
  realtimeSessionKey,
  saveRealtimeSession,
  type RealtimeSessionSnapshot,
} from "./realtime-session"
import type { Question } from "@/types"

const ROOM = "AB12CD"

const question: Question = {
  id: "q-1",
  type: "en2cn",
  word: { id: "w-1", word: "apple", meaning: "a fruit", meaningCn: "苹果" },
  options: ["苹果", "香蕉", "橙子", "西瓜"],
  correctAnswer: "苹果",
}

function snapshot(overrides: Partial<Omit<RealtimeSessionSnapshot, "version">> = {}) {
  return {
    roomId: ROOM,
    savedAt: Date.now(),
    isHost: true,
    wordLevel: "CET4" as const,
    questions: [question],
    currentIndex: 0,
    score1: 150,
    score2: 100,
    combo1: 1,
    combo2: 0,
    maxCombo1: 1,
    maxCombo2: 0,
    lastScoreGained1: 150,
    lastScoreGained2: 0,
    answers1: { "q-1": { answer: "苹果", correct: true, time: 5000 } },
    answers2: {},
    opponentId: "opponent-id",
    opponentUsername: "对手",
    selfFinished: false,
    ...overrides,
  }
}

beforeEach(() => {
  clearRealtimeSession(ROOM)
})

afterEach(() => {
  clearRealtimeSession(ROOM)
})

describe("realtime session snapshot", () => {
  it("round-trips a snapshot", () => {
    expect(saveRealtimeSession(snapshot())).toBe(true)
    const loaded = loadRealtimeSession(ROOM)
    expect(loaded).not.toBeNull()
    expect(loaded!.roomId).toBe(ROOM)
    expect(loaded!.score1).toBe(150)
    expect(loaded!.answers1["q-1"].correct).toBe(true)
    expect(loaded!.questions[0].correctAnswer).toBe("苹果")
  })

  it("stores under a room-scoped key", () => {
    saveRealtimeSession(snapshot())
    expect(window.sessionStorage.getItem(realtimeSessionKey(ROOM))).toBeTruthy()
    expect(loadRealtimeSession("OTHER1")).toBeNull()
  })

  it("returns null when nothing was saved", () => {
    expect(loadRealtimeSession(ROOM)).toBeNull()
  })

  it("drops a snapshot written for a different room id", () => {
    saveRealtimeSession(snapshot())
    const raw = JSON.parse(window.sessionStorage.getItem(realtimeSessionKey(ROOM))!)
    raw.roomId = "ZZZZZZ"
    window.sessionStorage.setItem(realtimeSessionKey(ROOM), JSON.stringify(raw))
    expect(loadRealtimeSession(ROOM)).toBeNull()
    // ...and cleans it up
    expect(window.sessionStorage.getItem(realtimeSessionKey(ROOM))).toBeNull()
  })

  it("drops corrupt json instead of throwing", () => {
    window.sessionStorage.setItem(realtimeSessionKey(ROOM), "{not json")
    expect(loadRealtimeSession(ROOM)).toBeNull()
  })

  it("drops expired snapshots", () => {
    saveRealtimeSession(snapshot({ savedAt: Date.now() - REALTIME_SESSION_TTL_MS - 1000 }))
    expect(loadRealtimeSession(ROOM)).toBeNull()
  })

  it("rejects snapshots with a wrong version", () => {
    saveRealtimeSession(snapshot())
    const raw = JSON.parse(window.sessionStorage.getItem(realtimeSessionKey(ROOM))!)
    raw.version = 99
    window.sessionStorage.setItem(realtimeSessionKey(ROOM), JSON.stringify(raw))
    expect(loadRealtimeSession(ROOM)).toBeNull()
  })

  it("rejects tampered fields (index out of range, bad answers, bad level)", () => {
    expect(loadRealtimeSession(ROOM, Date.now())).toBeNull()

    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1, currentIndex: 5 })).toBe(false)
    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1, wordLevel: "HACK" })).toBe(false)
    expect(
      isRealtimeSessionSnapshot({
        ...snapshot(),
        version: 1,
        answers1: { "q-1": { answer: "苹果", correct: "yes", time: 1 } },
      })
    ).toBe(false)
    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1, questions: [] })).toBe(false)
    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1, score1: "lots" })).toBe(false)
    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1, score1: NaN })).toBe(false)
  })

  it("accepts a valid snapshot", () => {
    expect(isRealtimeSessionSnapshot({ ...snapshot(), version: 1 })).toBe(true)
  })

  it("clear removes only this room", () => {
    saveRealtimeSession(snapshot())
    saveRealtimeSession(snapshot({ roomId: "KEEP01" }))
    clearRealtimeSession(ROOM)
    expect(loadRealtimeSession(ROOM)).toBeNull()
    expect(loadRealtimeSession("KEEP01")).not.toBeNull()
    clearRealtimeSession("KEEP01")
  })
})
