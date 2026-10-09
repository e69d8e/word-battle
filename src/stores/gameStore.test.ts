import { describe, it, expect, beforeEach } from "vitest"
import { useGameStore } from "./gameStore"
import type { Question, WordItem } from "@/types"

const mockQuestion1: Question = {
  id: "q-1",
  word: { id: "w-1", word: "apple", meaning: "a fruit", meaningCn: "苹果" },
  type: "en2cn",
  options: ["苹果", "香蕉", "橙子", "西瓜"],
  correctAnswer: "苹果",
}

const mockQuestion2: Question = {
  id: "q-2",
  word: { id: "w-2", word: "banana", meaning: "a yellow fruit", meaningCn: "香蕉" },
  type: "en2cn",
  options: ["苹果", "香蕉", "橙子", "西瓜"],
  correctAnswer: "香蕉",
}

const mockWords: WordItem[] = [
  { id: "w-1", word: "apple", meaning: "a fruit", meaningCn: "苹果" },
  { id: "w-2", word: "banana", meaning: "a yellow fruit", meaningCn: "香蕉" },
]

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  it("initializes with default waiting state", () => {
    const state = useGameStore.getState()
    expect(state.status).toBe("waiting")
    expect(state.mode).toBe("ai")
    expect(state.score1).toBe(0)
    expect(state.score2).toBe(0)
    expect(state.combo1).toBe(0)
    expect(state.currentIndex).toBe(0)
  })

  it("inits game with preset questions correctly", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])
    const state = useGameStore.getState()

    expect(state.status).toBe("playing")
    expect(state.questions).toHaveLength(2)
    expect(state.questions[0].id).toBe("q-1")
    expect(state.currentIndex).toBe(0)
  })

  it("calculates score correctly on correct answer", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    // Answer correctly in 5000ms:
    // baseScore: 100
    // timeBonus: Math.min(50, Math.floor((15000 - 5000) / 100)) = 50 (capped)
    // comboBonus: 0 (first correct answer, combo=1)
    // totalScore = 150
    const isCorrect = useGameStore.getState().submitAnswer(1, "苹果", 5000)

    expect(isCorrect).toBe(true)
    const state = useGameStore.getState()
    expect(state.score1).toBe(150)
    expect(state.combo1).toBe(1)
    expect(state.maxCombo1).toBe(1)
    expect(state.lastScoreGained1).toBe(150)
    expect(state.answers1["q-1"]).toEqual({
      answer: "苹果",
      correct: true,
      time: 5000,
    })
  })

  it("applies combo bonus on consecutive correct answers", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    // Q1 correct
    useGameStore.getState().submitAnswer(1, "苹果", 5000)
    useGameStore.getState().nextQuestion()

    // Q2 correct in 10000ms:
    // base: 100
    // timeBonus: Math.floor((15000 - 10000) / 100) = 50
    // nextCombo = 2 -> comboBonus: Math.min(50, (2 - 1) * 10) = 10
    // totalScore = 160
    useGameStore.getState().submitAnswer(1, "香蕉", 10000)

    const state = useGameStore.getState()
    expect(state.combo1).toBe(2)
    expect(state.maxCombo1).toBe(2)
    expect(state.lastScoreGained1).toBe(160)
    expect(state.score1).toBe(150 + 160)
  })

  it("resets combo and awards 0 score on wrong answer", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    // Q1 correct -> combo 1
    useGameStore.getState().submitAnswer(1, "苹果", 5000)
    useGameStore.getState().nextQuestion()

    // Q2 wrong answer
    const isCorrect = useGameStore.getState().submitAnswer(1, "橙子", 3000)

    expect(isCorrect).toBe(false)
    const state = useGameStore.getState()
    expect(state.combo1).toBe(0)
    expect(state.maxCombo1).toBe(1) // preserved
    expect(state.lastScoreGained1).toBe(0)
    expect(state.answers1["q-2"].correct).toBe(false)
  })

  it("prevents double submission for the same question", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    const firstSubmission = useGameStore.getState().submitAnswer(1, "苹果", 5000)
    expect(firstSubmission).toBe(true)

    // Second submission on same question
    const secondSubmission = useGameStore.getState().submitAnswer(1, "苹果", 3000)
    expect(secondSubmission).toBe(false)

    // Score remains unchanged
    expect(useGameStore.getState().score1).toBe(150)
  })

  it("syncs opponent answers by recomputing score locally", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-1",
      answer: "苹果",
      isCorrect: true,
      timeMs: 4000,
    })

    const state = useGameStore.getState()
    // Recomputed locally: base 100 + min(50, floor((15000-4000)/100)=110 -> capped 50) = 150
    expect(state.score2).toBe(150)
    expect(state.combo2).toBe(1)
    expect(state.maxCombo2).toBe(1)
    expect(state.lastScoreGained2).toBe(150)
    expect(state.answers2["q-1"]).toEqual({
      answer: "苹果",
      correct: true,
      time: 4000,
    })
  })

  it("ignores duplicate or unknown opponent answer broadcasts", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-1",
      answer: "苹果",
      isCorrect: true,
      timeMs: 4000,
    })
    // Replay of the same question must not add score again
    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-1",
      answer: "苹果",
      isCorrect: true,
      timeMs: 1000,
    })
    // Unknown question id must be ignored entirely
    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-unknown",
      answer: "香蕉",
      isCorrect: true,
      timeMs: 1000,
    })

    const state = useGameStore.getState()
    expect(state.score2).toBe(150)
    expect(Object.keys(state.answers2)).toEqual(["q-1"])
  })

  it("recomputes the opponent total instead of trusting a forged final score", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    // A peer controls everything it puts on the wire, so the runtime payload can
    // carry a bogus cumulative total even though the type does not mention it.
    // (Passed via a variable on purpose: no excess-property check, like a socket.)
    const wirePayload = {
      answers: { "q-1": { answer: "苹果", correct: true, time: 4000 } },
      finalScore: 999_999,
      maxCombo: 42,
    }
    useGameStore.getState().syncOpponentFinished(wirePayload)

    const state = useGameStore.getState()
    // base 100 + time bonus 50 — never the claimed 999_999
    expect(state.score2).toBe(150)
    expect(state.maxCombo2).toBe(1)
  })

  it("sanitizes opponent answers received in the finished payload", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    useGameStore.getState().syncOpponentFinished({
      answers: {
        "q-1": { answer: "苹果", correct: true, time: 5000 },
        // Unknown question id must be dropped
        "q-unknown": { answer: "x", correct: true, time: 0 },
        // Wrong shape must be dropped
        "q-2": { answer: "香蕉", correct: "yes", time: 1000 },
      },
    } as unknown as {
      answers?: Record<string, { answer: string; correct: boolean; time: number }>
    })

    const state = useGameStore.getState()
    expect(Object.keys(state.answers2)).toEqual(["q-1"])
    expect(state.score2).toBe(150)
  })

  it("keeps incremental and final opponent scoring consistent", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    // Live broadcasts: q-1 then q-2, both correct -> combo 1 then 2
    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-1",
      answer: "苹果",
      isCorrect: true,
      timeMs: 10000,
    })
    useGameStore.getState().nextQuestion()
    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-2",
      answer: "香蕉",
      isCorrect: true,
      timeMs: 10000,
    })
    const incremental = useGameStore.getState()
    expect(incremental.score2).toBe(310) // 150 + (100 + 50 + 10 combo)
    expect(incremental.maxCombo2).toBe(2)

    // The same two answers delivered as the final payload must add up identically
    useGameStore.getState().resetGame()
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])
    useGameStore.getState().syncOpponentFinished({
      answers: {
        "q-1": { answer: "苹果", correct: true, time: 10000 },
        "q-2": { answer: "香蕉", correct: true, time: 10000 },
      },
    })

    const replayed = useGameStore.getState()
    expect(replayed.score2).toBe(310)
    expect(replayed.maxCombo2).toBe(2)
  })

  it("transitions question, finish, and reset states properly", () => {
    useGameStore.getState().initGame("ai", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    useGameStore.getState().nextQuestion()
    expect(useGameStore.getState().currentIndex).toBe(1)

    // Cannot advance past the last question
    useGameStore.getState().nextQuestion()
    expect(useGameStore.getState().currentIndex).toBe(1)

    useGameStore.getState().finishGame()
    expect(useGameStore.getState().status).toBe("finished")

    useGameStore.getState().resetGame()
    expect(useGameStore.getState().status).toBe("waiting")
    expect(useGameStore.getState().questions).toHaveLength(0)
  })
})
