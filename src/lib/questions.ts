import type { WordItem, Question, QuestionType } from "@/types"
import { shuffleArray, getRandomItems } from "@/lib/utils"

export function generateQuestion(word: WordItem, allWords: WordItem[]): Question {
  const types: QuestionType[] = ["en2cn", "cn2en", "listening"]
  const type = types[Math.floor(Math.random() * types.length)]

  let correctAnswer: string
  let target: string
  let getOption: (w: WordItem) => string

  if (type === "en2cn") {
    correctAnswer = word.meaningCn
    target = word.meaningCn.trim()
    getOption = (w) => w.meaningCn.trim()
  } else {
    // cn2en and listening share the same logic
    correctAnswer = word.word
    target = word.word.toLowerCase().trim()
    getOption = (w) => w.word
  }

  // Distractors are deduped by a normalized key (trimmed, case-insensitive) so
  // whitespace/case variants can't slip past as "different" options.
  const seen = new Set<string>([target])
  const distractors: string[] = []
  const n = allWords.length

  const tryAdd = (w: WordItem) => {
    if (distractors.length >= 3) return
    const display = getOption(w)
    const key = display.toLowerCase().trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    distractors.push(display)
  }

  // O(1) random sampling for distractors to avoid copying/filtering thousands of words
  const maxAttempts = Math.min(60, n * 3)
  let attempts = 0
  while (distractors.length < 3 && attempts < maxAttempts && n > 1) {
    attempts++
    tryAdd(allWords[Math.floor(Math.random() * n)])
  }

  // Fallback if pool is very small or highly duplicated
  if (distractors.length < 3 && n > 1) {
    for (const w of allWords) {
      tryAdd(w)
      if (distractors.length >= 3) break
    }
  }

  let options = [correctAnswer, ...distractors]

  // Ensure minimum 4 options (pad with placeholders if word pool is too small)
  let padIndex = 1
  while (options.length < 4) {
    options.push(`选项${padIndex++}`)
  }

  options = shuffleArray(options)

  const uid = Math.random().toString(36).substring(2, 7)
  return {
    id: `${word.id}-${type}-${uid}`,
    word,
    type,
    options,
    correctAnswer,
  }
}

export function generateQuestions(words: WordItem[], count: number): Question[] {
  return getRandomItems(words, count).map((w) => generateQuestion(w, words))
}
