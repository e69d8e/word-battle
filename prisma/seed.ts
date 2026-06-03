import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

interface WordData {
  word: string
  phonetic: string
  meaning: string
  meaningCn: string
  example: string
}

async function seedWordList(level: string, name: string, dataFile: string) {
  const existing = await prisma.wordList.findFirst({
    where: { level },
  })

  if (existing) {
    console.log(`Word list for ${level} already exists, skipping...`)
    return
  }

  const filePath = path.join(__dirname, `../src/data/words/${dataFile}`)
  const rawData = fs.readFileSync(filePath, "utf-8")
  const words: WordData[] = JSON.parse(rawData)

  const wordList = await prisma.wordList.create({
    data: {
      name,
      level,
    },
  })

  await prisma.word.createMany({
    data: words.map((w) => ({
      word: w.word,
      phonetic: w.phonetic,
      meaning: w.meaning,
      meaningCn: w.meaningCn,
      example: w.example,
      wordListId: wordList.id,
    })),
  })

  console.log(`Seeded ${words.length} words for ${level}`)
}

async function main() {
  console.log("🌱 Seeding database...")

  await seedWordList("CET4", "CET-4 核心词汇", "cet4.json")
  await seedWordList("CET6", "CET-6 核心词汇", "cet6.json")
  await seedWordList("TOEFL", "TOEFL 核心词汇", "toefl.json")
  await seedWordList("IELTS", "IELTS 核心词汇", "ielts.json")

  console.log("✅ Seeding completed!")
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
