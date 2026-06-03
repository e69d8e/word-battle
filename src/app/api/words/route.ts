import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import cet4Data from "@/data/words/cet4.json"
import cet6Data from "@/data/words/cet6.json"
import toeflData from "@/data/words/toefl.json"
import ieltsData from "@/data/words/ielts.json"
import type { WordLevel } from "@/types"

// Word data mapping
const wordDataMap: Record<string, { name: string; data: typeof cet4Data }> = {
  CET4: { name: "CET-4 核心词汇", data: cet4Data },
  CET6: { name: "CET-6 核心词汇", data: cet6Data },
  TOEFL: { name: "TOEFL 核心词汇", data: toeflData },
  IELTS: { name: "IELTS 核心词汇", data: ieltsData },
}

// Initialize word list for a specific level if it doesn't exist
async function initWordsForLevel(level: string) {
  const existing = await prisma.wordList.findFirst({
    where: { level },
  })

  if (existing) return existing

  const wordData = wordDataMap[level]
  if (!wordData) return null

  const wordList = await prisma.wordList.create({
    data: {
      name: wordData.name,
      level: level,
    },
  })

  await prisma.word.createMany({
    data: wordData.data.map((w) => ({
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      meaningCn: w.meaningCn,
      example: w.example,
      wordListId: wordList.id,
    })),
  })

  return wordList
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level = (searchParams.get("level") || "CET4") as WordLevel

    // Initialize word list for the requested level if needed
    await initWordsForLevel(level)

    const wordList = await prisma.wordList.findFirst({
      where: { level },
      include: {
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

    if (!wordList) {
      return NextResponse.json(
        { error: "未找到对应级别的单词库" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      wordList: {
        id: wordList.id,
        name: wordList.name,
        level: wordList.level,
        wordCount: wordList.words.length,
      },
      words: wordList.words,
    })
  } catch (error) {
    console.error("Get words error:", error)
    return NextResponse.json(
      { error: "获取单词失败" },
      { status: 500 }
    )
  }
}
