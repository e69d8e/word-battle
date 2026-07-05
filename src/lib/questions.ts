import type { WordItem, Question, QuestionType } from "@/types"
import { shuffleArray, getRandomItems } from "@/lib/utils"

export function generateQuestion(word: WordItem, allWords: WordItem[]): Question {
  const types: QuestionType[] = ["en2cn", "cn2en", "listening"]
  const type = types[Math.floor(Math.random() * types.length)]

  let correctAnswer: string
  let options: string[]

  if (type === "en2cn") {
    correctAnswer = word.meaningCn
    const otherMeanings = [...new Set(
      allWords.filter((w) => w.id !== word.id).map((w) => w.meaningCn)
    )]
    options = [correctAnswer, ...getRandomItems(otherMeanings, 3)]
  } else {
    // cn2en and listening share the same logic
    correctAnswer = word.word
    const otherWords = [...new Set(
      allWords.filter((w) => w.id !== word.id).map((w) => w.word)
    )]
    options = [correctAnswer, ...getRandomItems(otherWords, 3)]
  }

  // Deduplicate options (correct answer may appear in distractors if meanings overlap)
  options = [...new Set(options)]

  // Ensure minimum 4 options (pad with placeholders if word pool is too small)
  while (options.length < 4) {
    options.push(`选项${options.length + 1}`)
  }

  options = shuffleArray(options)

  return {
    id: word.id + "-" + type,
    word,
    type,
    options,
    correctAnswer,
  }
}

export function generateQuestions(words: WordItem[], count: number): Question[] {
  return getRandomItems(words, count).map((w) => generateQuestion(w, words))
}
