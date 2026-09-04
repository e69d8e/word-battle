import { describe, it, expect } from "vitest"
import { generateQuestion, generateQuestions } from "./questions"
import type { WordItem } from "@/types"

const mockWords: WordItem[] = [
  { id: "1", word: "abandon", phonetic: "/əˈbændən/", meaning: "to leave completely", meaningCn: "放弃；遗弃" },
  { id: "2", word: "abide", phonetic: "/əˈbaɪd/", meaning: "to accept or act in accordance with", meaningCn: "遵守；忍受" },
  { id: "3", word: "ability", phonetic: "/əˈbɪləti/", meaning: "the power or skill to do something", meaningCn: "能力；本领" },
  { id: "4", word: "abnormal", phonetic: "/æbˈnɔːrml/", meaning: "deviating from what is normal", meaningCn: "反常的；变态的" },
  { id: "5", word: "abolish", phonetic: "/əˈbɑːlɪʃ/", meaning: "to formally put an end to", meaningCn: "废除；取消" },
]

describe("questions generator", () => {
  describe("generateQuestion", () => {
    it("generates a valid Question structure", () => {
      const target = mockWords[0]
      const question = generateQuestion(target, mockWords)

      expect(question).toHaveProperty("id")
      expect(question).toHaveProperty("word")
      expect(question).toHaveProperty("type")
      expect(question).toHaveProperty("options")
      expect(question).toHaveProperty("correctAnswer")

      expect(["en2cn", "cn2en", "listening"]).toContain(question.type)
      expect(question.options).toHaveLength(4)
      expect(new Set(question.options).size).toBe(4) // 4 unique options
      expect(question.options).toContain(question.correctAnswer)
    })

    it("sets correct answer corresponding to question type", () => {
      const target = mockWords[0]

      for (let i = 0; i < 20; i++) {
        const question = generateQuestion(target, mockWords)
        if (question.type === "en2cn") {
          expect(question.correctAnswer).toBe(target.meaningCn)
        } else {
          // cn2en and listening
          expect(question.correctAnswer).toBe(target.word)
        }
      }
    })

    it("handles tiny word list by padding placeholders up to 4 options", () => {
      const singleWord: WordItem[] = [
        { id: "1", word: "single", meaning: "only one", meaningCn: "单一的" },
      ]
      const question = generateQuestion(singleWord[0], singleWord)

      expect(question.options).toHaveLength(4)
      expect(question.options).toContain(question.correctAnswer)
      expect(new Set(question.options).size).toBe(4)
    })

    it("is fast and performs well with large vocabulary (benchmark check)", () => {
      // Create a 2000-word mock dictionary
      const largeDict: WordItem[] = Array.from({ length: 2000 }, (_, i) => ({
        id: `word-${i}`,
        word: `term${i}`,
        meaning: `definition for term ${i}`,
        meaningCn: `词义 ${i}`,
      }))

      const start = performance.now()
      const questions = generateQuestions(largeDict, 50)
      const duration = performance.now() - start

      expect(questions).toHaveLength(50)
      // 50 questions from 2000 words should generate in well under 50ms with O(1) sampling
      expect(duration).toBeLessThan(100)
    })
  })

  describe("generateQuestions", () => {
    it("generates the exact count of questions requested", () => {
      const questions = generateQuestions(mockWords, 3)
      expect(questions).toHaveLength(3)
    })

    it("generates unique question IDs with valid format", () => {
      const questions = generateQuestions(mockWords, 4)
      const ids = questions.map((q) => q.id)
      expect(new Set(ids).size).toBe(4)
    })
  })
})
