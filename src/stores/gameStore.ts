import { create } from "zustand"
import type { GameState, GameMode, WordLevel, Question, QuestionType } from "@/types"
import { shuffleArray, getRandomItems } from "@/lib/utils"
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

function generateQuestion(word: WordItem, allWords: WordItem[]): Question {
  const types: QuestionType[] = ["en2cn", "cn2en", "listening"]
  const type = types[Math.floor(Math.random() * types.length)]

  let correctAnswer: string
  let options: string[]

  if (type === "en2cn") {
    correctAnswer = word.meaningCn
    const otherMeanings = [...new Set(
      allWords.filter((w) => w.id !== word.id).map((w) => w.meaningCn)
    )]
    options = shuffleArray([correctAnswer, ...getRandomItems(otherMeanings, 3)])
  } else if (type === "cn2en") {
    correctAnswer = word.word
    const otherWords = [...new Set(
      allWords.filter((w) => w.id !== word.id).map((w) => w.word)
    )]
    options = shuffleArray([correctAnswer, ...getRandomItems(otherWords, 3)])
  } else {
    // listening
    correctAnswer = word.word
    const otherWords = [...new Set(
      allWords.filter((w) => w.id !== word.id).map((w) => w.word)
    )]
    options = shuffleArray([correctAnswer, ...getRandomItems(otherWords, 3)])
  }

  // Ensure minimum 4 options (pad with placeholders if word pool is too small)
  while (options.length < 4) {
    options.push(`选项${options.length + 1}`)
  }

  return {
    id: word.id + "-" + type,
    word,
    type,
    options,
    correctAnswer,
  }
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
    const questions = presetQuestions ?? getRandomItems(words, totalQ).map((w) => generateQuestion(w, words))

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
    const timeBonus = isCorrect ? Math.max(0, Math.floor((5000 - timeMs) / 100)) : 0
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
