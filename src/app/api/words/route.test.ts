import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

describe("GET /api/words", () => {
  it("returns 200 with wordList and cached words for CET4", async () => {
    const req = new NextRequest("http://localhost:3000/api/words?level=CET4")
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toContain("public")

    const body = await res.json()
    expect(body.wordList.level).toBe("CET4")
    expect(body.wordList.name).toBe("CET-4 核心词汇")
    expect(body.words.length).toBeGreaterThan(100)

    const firstWord = body.words[0]
    expect(firstWord).toHaveProperty("id")
    expect(firstWord).toHaveProperty("word")
    expect(firstWord).toHaveProperty("meaningCn")
  })

  it("returns word list for other valid levels like TOEFL", async () => {
    const req = new NextRequest("http://localhost:3000/api/words?level=TOEFL")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.wordList.level).toBe("TOEFL")
    expect(body.wordList.name).toBe("TOEFL 核心词汇")
  })

  it("returns 404 when requested level does not exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/words?level=INVALID_LEVEL")
    const res = await GET(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("未找到对应级别的单词库")
  })
})
