import { create } from "zustand"
import type { GameState, GameMode, WordLevel, Question } from "@/types"
import { generateQuestions } from "@/lib/questions"
import type { WordItem } from "@/types"

type AnswerMap = GameState["answers1"]

const QUESTION_TIME_LIMIT_MS = 15_000

/**
 * Canonical per-question score. Every player must derive scores from this
 * formula locally — a remote "final score" is never trusted.
 * base 100 + time bonus (up to 50) + combo bonus (10 * (combo - 1), capped 50)
 */
export function scoreForAnswer(isCorrect: boolean, timeMs: number, comboAfter: number): number {
  if (!isCorrect) return 0
  const baseScore = 100
  const timeBonus = Math.min(
    50,
    Math.max(0, Math.floor((QUESTION_TIME_LIMIT_MS - Math.max(0, timeMs)) / 100))
  )
  const comboBonus = comboAfter >= 2 ? Math.min(50, (comboAfter - 1) * 10) : 0
  return baseScore + timeBonus + comboBonus
}

/**
 * Recompute a player's total from their answer map, walking the questions in
 * order so combos match what that player's own client calculated.
 */
export function recomputeFromAnswers(
  questions: Question[],
  answers: AnswerMap
): { score: number; maxCombo: number } {
  let score = 0
  let combo = 0
  let maxCombo = 0

  for (const question of questions) {
    const answer = answers[question.id]
    if (!answer) continue
    combo = answer.correct ? combo + 1 : 0
    maxCombo = Math.max(maxCombo, combo)
    score += scoreForAnswer(answer.correct, answer.time, combo)
  }

  return { score, maxCombo }
}

interface GameStore extends GameState {
  // Actions
  initGame: (mode: GameMode, wordLevel: WordLevel, words: WordItem[], totalQ?: number, presetQuestions?: Question[]) => void
  /** Re-enter an in-progress realtime match after a page reload. */
  restoreGame: (snapshot: {
    mode: GameMode
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
    startTime: number
    questionStartTime: number
  }) => void
  submitAnswer: (player: 1 | 2, answer: string, timeMs: number) => boolean
  syncOpponentAnswer: (data: {
    questionId: string
    answer: string
    isCorrect: boolean
    timeMs: number
  }) => void
  syncOpponentFinished: (data: {
    // Only the answer map is accepted: the peer's self-reported totals are
    // attacker-controllable and are ignored on purpose (see implementation).
    answers?: Record<string, { answer: string; correct: boolean; time: number }>
  }) => void
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
  combo1: 0,
  combo2: 0,
  maxCombo1: 0,
  maxCombo2: 0,
  lastScoreGained1: 0,
  lastScoreGained2: 0,
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
      combo1: 0,
      combo2: 0,
      maxCombo1: 0,
      maxCombo2: 0,
      lastScoreGained1: 0,
      lastScoreGained2: 0,
      answers1: {},
      answers2: {},
      startTime: Date.now(),
      questionStartTime: Date.now(),
    })
  },

  restoreGame: (snapshot) => {
    // Questions come from the shared match payload, so a reloaded client plays
    // the exact same set as its opponent.
    set({
      ...snapshot,
      status: "playing",
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
    const currentCombo = player === 1 ? state.combo1 : state.combo2
    const nextCombo = isCorrect ? currentCombo + 1 : 0
    const currentMaxCombo = player === 1 ? state.maxCombo1 : state.maxCombo2
    const nextMaxCombo = Math.max(currentMaxCombo, nextCombo)

    const totalScore = scoreForAnswer(isCorrect, timeMs, nextCombo)

    const scoreKey = player === 1 ? "score1" : "score2"
    const comboKey = player === 1 ? "combo1" : "combo2"
    const maxComboKey = player === 1 ? "maxCombo1" : "maxCombo2"
    const lastScoreGainedKey = player === 1 ? "lastScoreGained1" : "lastScoreGained2"

    set({
      [answersKey]: {
        ...state[answersKey],
        [question.id]: { answer, correct: isCorrect, time: timeMs },
      },
      [scoreKey]: state[scoreKey] + totalScore,
      [comboKey]: nextCombo,
      [maxComboKey]: nextMaxCombo,
      [lastScoreGainedKey]: isCorrect ? totalScore : 0,
    })

    return isCorrect
  },

  syncOpponentAnswer: ({ questionId, answer, isCorrect, timeMs }) => {
    const state = get()
    // Ignore duplicate / out-of-order broadcasts and unknown question ids
    if (state.answers2[questionId]) return
    if (!state.questions.some((q) => q.id === questionId)) return

    // Recompute with the same formula as submitAnswer instead of trusting the
    // opponent's claimed cumulative total (which is attacker-controllable).
    const nextCombo = isCorrect ? state.combo2 + 1 : 0
    const gained = scoreForAnswer(isCorrect, timeMs, nextCombo)

    set({
      score2: state.score2 + gained,
      combo2: nextCombo,
      maxCombo2: Math.max(state.maxCombo2, nextCombo),
      lastScoreGained2: gained,
      answers2: {
        ...state.answers2,
        [questionId]: { answer, correct: isCorrect, time: timeMs },
      },
    })
  },

  syncOpponentFinished: ({ answers }) => {
    const state = get()

    // Sanitize: only keep answers for questions this game actually has, and
    // only if the shape is what we expect. A peer must not be able to inject
    // arbitrary ids or non-numeric values into our own answer map / save.
    const knownQuestionIds = new Set(state.questions.map((q) => q.id))
    const sanitized: AnswerMap = {}
    for (const [questionId, raw] of Object.entries(answers ?? {})) {
      if (!knownQuestionIds.has(questionId)) continue
      if (!raw || typeof raw.correct !== "boolean") continue
      const time = Number(raw.time)
      sanitized[questionId] = {
        answer: typeof raw.answer === "string" ? raw.answer : "",
        correct: raw.correct,
        time: Number.isFinite(time) && time >= 0 ? time : 0,
      }
    }

    // The peer's claimed finalScore/maxCombo are deliberately discarded:
    // recomputing from the answer map keeps a forged total from inflating the
    // opponent (and from pushing our own save payload past the API's score cap).
    const merged = { ...state.answers2, ...sanitized }
    const { score, maxCombo } = recomputeFromAnswers(state.questions, merged)

    set({
      answers2: merged,
      score2: score,
      maxCombo2: Math.max(state.maxCombo2, maxCombo),
    })
  },

  nextQuestion: () => {
    const state = get()
    if (state.currentIndex < state.questions.length - 1) {
      set({
        currentIndex: state.currentIndex + 1,
        questionStartTime: Date.now(),
        lastScoreGained1: 0,
        lastScoreGained2: 0,
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
      combo1: 0,
      combo2: 0,
      maxCombo1: 0,
      maxCombo2: 0,
      lastScoreGained1: 0,
      lastScoreGained2: 0,
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
