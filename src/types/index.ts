export interface User {
  id: string
  username: string
  avatar?: string | null
  createdAt: Date
}

export interface WordItem {
  id: string
  word: string
  phonetic?: string | null
  meaning: string
  meaningCn: string
  example?: string | null
}

export interface WordList {
  id: string
  name: string
  level: string
  words: WordItem[]
}

export type QuestionType = "en2cn" | "cn2en" | "listening"

export interface Question {
  id: string
  word: WordItem
  type: QuestionType
  options: string[]
  correctAnswer: string
}

export type GameMode = "ai" | "realtime" | "async"
export type GameStatus = "waiting" | "playing" | "finished"
export type WordLevel = "CET4" | "CET6" | "TOEFL" | "IELTS"

export interface GameState {
  mode: GameMode
  status: GameStatus
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
  answers1: Record<string, { answer: string; correct: boolean; time: number }>
  answers2: Record<string, { answer: string; correct: boolean; time: number }>
  startTime: number
  questionStartTime: number
}

export interface GameResult {
  gameId: string
  mode: GameMode
  player1: { username: string; score: number; maxCombo?: number; accuracy?: number; avgTime?: number }
  player2: { username: string; score: number; maxCombo?: number; accuracy?: number; avgTime?: number }
  winner: string | null
  questions: {
    word: string
    phonetic?: string | null
    meaningCn?: string
    meaning?: string
    example?: string | null
    type: QuestionType
    correct1: boolean
    correct2: boolean
  }[]
}

export interface LeaderboardEntry {
  userId: string
  username: string
  score: number
  mode: GameMode
  level: WordLevel
  createdAt: Date
}
