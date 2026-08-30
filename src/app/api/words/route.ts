import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api"
import cet4Data from "@/data/words/cet4.json"
import cet6Data from "@/data/words/cet6.json"
import toeflData from "@/data/words/toefl.json"
import ieltsData from "@/data/words/ielts.json"
import type { WordLevel } from "@/types"

// Word data mapping — returned directly from memory for instant response (<1ms) and 100% availability
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
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    }

    return apiSuccess(
      {
        wordList: {
          name: wordData.name,
          level,
          wordCount: wordData.data.length,
        },
        words: wordData.data.map((w, i) => ({
          id: `${level.toLowerCase()}-${i}`,
          word: w.word,
          phonetic: w.phonetic || null,
          meaning: w.meaning,
          meaningCn: w.meaningCn,
          example: w.example || null,
        })),
      },
      { headers: cacheHeaders }
    )
  } catch (error) {
    console.error("Get words error:", error)
    return apiError("获取单词列表失败", 500)
  }
}
