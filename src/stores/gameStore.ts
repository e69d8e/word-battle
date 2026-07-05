import { create } from "zustand"
import type { GameState, GameMode, WordLevel, Question } from "@/types"
import { generateQuestions } from "@/lib/questions"
import type { WordItem } from "@/types"

interface GameStore extends GameState {
  // Actions
  initGame: (mode: GameMode, wordLevel: WordLevel, words: WordItem[], totalQ?: number, presetQuestions?: Question[]) => void
  submitAnswer: (player: 1 | 2, answer: string, timeMs: number) => boolean
  nextQuestion: () => void
  finishGame: () => void
  resetGame: () => void
  setGameStatus: (status: GameState["status"]) => void
  updateScore: (player: 1 | 2, score: number) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  mode: "ai",
  status: "waiting",
  wordLevel: "CET4",
  questions: [],
  currentIndex: 0,
  score1: 0,
  score2: 0,
  answers1: {},
  answers2: {},
  startTime: 0,
  questionStartTime: 0,

  initGame: (mode, wordLevel, words, totalQ = 10, presetQuestions) => {
    const questions = presetQuestions ?? generateQuestions(words, totalQ)

    set({
      mode,
      status: "playing",
      wordLevel,
      questions,
      currentIndex: 0,
      score1: 0,
      score2: 0,
      answers1: {},
      answers2: {},
      startTime: Date.now(),
      questionStartTime: Date.now(),
    })
  },

  submitAnswer: (player, answer, timeMs) => {
    const state = get()
    const question = state.questions[state.currentIndex]
    if (!question) return false

    // Guard against double-submission for the same question
    const answersKey = player === 1 ? "answers1" : "answers2"
    if (state[answersKey][question.id]) return false

    const isCorrect = answer === question.correctAnswer
    const baseScore = isCorrect ? 100 : 0
    const timeBonus = isCorrect ? Math.max(0, Math.floor((15000 - timeMs) / 100)) : 0
    const totalScore = baseScore + timeBonus

    const scoreKey = player === 1 ? "score1" : "score2"

    set({
      [answersKey]: {
        ...state[answersKey],
        [question.id]: { answer, correct: isCorrect, time: timeMs },
      },
      [scoreKey]: state[scoreKey] + totalScore,
    })

    return isCorrect
  },

  nextQuestion: () => {
    const state = get()
    if (state.currentIndex < state.questions.length - 1) {
      set({
        currentIndex: state.currentIndex + 1,
        questionStartTime: Date.now(),
      })
    }
  },

  finishGame: () => {
    set({ status: "finished" })
  },

  resetGame: () => {
    set({
      mode: "ai",
      status: "waiting",
      wordLevel: "CET4",
      questions: [],
      currentIndex: 0,
      score1: 0,
      score2: 0,
      answers1: {},
      answers2: {},
      startTime: 0,
      questionStartTime: 0,
    })
  },

  setGameStatus: (status) => set({ status }),
  updateScore: (player, score) =>
    set(player === 1 ? { score1: score } : { score2: score }),
}))
