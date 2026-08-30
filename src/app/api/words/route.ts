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

    const cacheHeaders = {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    }

    const dbWordList = await prisma.wordList.findFirst({
      where: { level },
      select: {
        id: true,
        name: true,
        words: {
          select: {
            id: true,
            word: true,
            phonetic: true,
            meaning: true,
            meaningCn: true,
            example: true,
          },
        },
      },
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
      }, { headers: cacheHeaders })
    }

    return apiSuccess({
      wordList: {
        name: dbWordList.name,
        level,
        wordCount: dbWordList.words.length,
      },
      words: dbWordList.words,
    }, { headers: cacheHeaders })
  } catch (error) {
    console.error("Get words error (falling back to local data):", error)
    const { searchParams } = new URL(req.url)
    const level = (searchParams.get("level") || "CET4") as WordLevel
    const wordData = wordDataMap[level] || wordDataMap.CET4

    return apiSuccess({
      wordList: {
        name: wordData.name,
        level,
        wordCount: wordData.data.length,
      },
      words: wordData.data.map((w, i) => ({
        id: `local-${level}-${i}`,
        word: w.word,
        phonetic: w.phonetic || null,
        meaning: w.meaning,
        meaningCn: w.meaningCn,
        example: w.example || null,
      })),
    }, {
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  }
}
