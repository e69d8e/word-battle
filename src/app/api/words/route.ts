import { NextRequest, NextResponse } from "next/server"
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
      return NextResponse.json(
        { error: "未找到对应级别的单词库" },
        { status: 404 }
      )
    }

    // Return words directly from in-memory JSON — no DB round-trip
    return NextResponse.json({
      wordList: {
        name: wordData.name,
        level,
        wordCount: wordData.data.length,
      },
      words: wordData.data.map((w, i) => ({
        id: `${level}-${i}`,
        ...w,
      })),
    })
  } catch (error) {
    console.error("Get words error:", error)
    return NextResponse.json(
      { error: "获取单词失败" },
      { status: 500 }
    )
  }
}
