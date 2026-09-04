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
    // timeBonus: Math.floor((15000 - 5000) / 100) = 100
    // comboBonus: 0 (first correct answer, combo=1)
    // totalScore = 200
    const isCorrect = useGameStore.getState().submitAnswer(1, "苹果", 5000)

    expect(isCorrect).toBe(true)
    const state = useGameStore.getState()
    expect(state.score1).toBe(200)
    expect(state.combo1).toBe(1)
    expect(state.maxCombo1).toBe(1)
    expect(state.lastScoreGained1).toBe(200)
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
    expect(state.score1).toBe(200 + 160)
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
    expect(useGameStore.getState().score1).toBe(200)
  })

  it("syncs opponent answers correctly in multiplayer mode", () => {
    useGameStore.getState().initGame("realtime", "CET4", mockWords, 2, [mockQuestion1, mockQuestion2])

    useGameStore.getState().syncOpponentAnswer({
      questionId: "q-1",
      answer: "苹果",
      isCorrect: true,
      timeMs: 4000,
      totalScore: 210,
      combo: 1,
      maxCombo: 1,
      lastScoreGained: 210,
    })

    const state = useGameStore.getState()
    expect(state.score2).toBe(210)
    expect(state.combo2).toBe(1)
    expect(state.maxCombo2).toBe(1)
    expect(state.lastScoreGained2).toBe(210)
    expect(state.answers2["q-1"]).toEqual({
      answer: "苹果",
      correct: true,
      time: 4000,
    })
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
