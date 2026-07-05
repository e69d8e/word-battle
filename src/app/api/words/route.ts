import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import cet4Data from "@/data/words/cet4.json"
import cet6Data from "@/data/words/cet6.json"
import toeflData from "@/data/words/toefl.json"
import ieltsData from "@/data/words/ielts.json"
import type { WordLevel } from "@/types"

// Word data mapping — returned directly from memory, no DB query needed
const wordDataMap: Record<string, { name: string; data: typeof cet4Data }> = {
  CET4: { name: "CET-4 核心词汇", data: cet4Data },
  CET6: { name: "CET-6 核心词汇", data: cet6Data },
  TOEFL: { name: "TOEFL 核心词汇", data: toeflData },
  IELTS: { name: "IELTS 核心词汇", data: ieltsData },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level = (searchParams.get("level") || "CET4") as WordLevel

    const wordData = wordDataMap[level]
    if (!wordData) {
      return apiError("未找到对应级别的单词库", 404)
    }

    const dbWordList = await prisma.wordList.findFirst({
      where: { level },
      include: { words: true },
    })

    if (!dbWordList || dbWordList.words.length === 0) {
      console.log(`Word list for ${level} not found or empty in DB. Auto-seeding...`)

      if (dbWordList) {
        await prisma.wordList.delete({ where: { id: dbWordList.id } })
      }

      const newWordList = await prisma.wordList.create({
        data: { name: wordData.name, level },
      })

      await prisma.word.createMany({
        data: wordData.data.map((w) => ({
          word: w.word,
          phonetic: w.phonetic || null,
          meaning: w.meaning,
          meaningCn: w.meaningCn,
          example: w.example || null,
          wordListId: newWordList.id,
        })),
      })

      // Return seeded data directly — no need to re-query DB
      return apiSuccess({
        wordList: { name: wordData.name, level, wordCount: wordData.data.length },
        words: wordData.data.map((w, i) => ({
          id: `${newWordList.id}-${i}`,
          word: w.word,
          phonetic: w.phonetic || null,
          meaning: w.meaning,
          meaningCn: w.meaningCn,
          example: w.example || null,
        })),
      })
    }

    return apiSuccess({
      wordList: {
        name: dbWordList.name,
        level,
        wordCount: dbWordList.words.length,
      },
      words: dbWordList.words.map((w) => ({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic,
        meaning: w.meaning,
        meaningCn: w.meaningCn,
        example: w.example,
      })),
    })
  } catch (error) {
    console.error("Get words error:", error)
    return apiError("获取单词失败")
  }
}
