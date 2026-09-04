import type { WordItem, Question, QuestionType } from "@/types"
import { shuffleArray, getRandomItems } from "@/lib/utils"

export function generateQuestion(word: WordItem, allWords: WordItem[]): Question {
  const types: QuestionType[] = ["en2cn", "cn2en", "listening"]
  const type = types[Math.floor(Math.random() * types.length)]

  let correctAnswer: string
  const distractors = new Set<string>()
  const n = allWords.length

  if (type === "en2cn") {
    correctAnswer = word.meaningCn
    const targetMeaning = word.meaningCn.trim()

    // O(1) random sampling for distractors to avoid copying/filtering thousands of words
    const maxAttempts = Math.min(60, n * 3)
    let attempts = 0
    while (distractors.size < 3 && attempts < maxAttempts && n > 1) {
      attempts++
      const randomWord = allWords[Math.floor(Math.random() * n)]
      const cand = randomWord.meaningCn.trim()
      if (cand && cand !== targetMeaning && !distractors.has(randomWord.meaningCn)) {
        distractors.add(randomWord.meaningCn)
      }
    }

    // Fallback if pool is very small or highly duplicated
    if (distractors.size < 3 && n > 1) {
      for (const w of allWords) {
        if (w.meaningCn.trim() !== targetMeaning && !distractors.has(w.meaningCn)) {
          distractors.add(w.meaningCn)
          if (distractors.size >= 3) break
        }
      }
    }
  } else {
    // cn2en and listening share the same logic
    correctAnswer = word.word
    const targetWord = word.word.toLowerCase().trim()

    const maxAttempts = Math.min(60, n * 3)
    let attempts = 0
    while (distractors.size < 3 && attempts < maxAttempts && n > 1) {
      attempts++
      const randomWord = allWords[Math.floor(Math.random() * n)]
      const cand = randomWord.word.toLowerCase().trim()
      if (cand && cand !== targetWord && !distractors.has(randomWord.word)) {
        distractors.add(randomWord.word)
      }
    }

    // Fallback if pool is very small
    if (distractors.size < 3 && n > 1) {
      for (const w of allWords) {
        if (w.word.toLowerCase().trim() !== targetWord && !distractors.has(w.word)) {
          distractors.add(w.word)
          if (distractors.size >= 3) break
        }
      }
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
