"use client"

import { useState, useEffect } from "react"
import type { WordLevel, WordItem } from "@/types"

const wordCache = new Map<WordLevel, WordItem[]>()

export function useWords(level: WordLevel) {
  const cached = wordCache.get(level)
  const [data, setData] = useState<{ level: WordLevel; words: WordItem[]; isLoading: boolean }>(() => ({
    level,
    words: cached || [],
    isLoading: !cached,
  }))

  const isCurrentLevel = data.level === level
  const words = isCurrentLevel ? data.words : (cached || [])
  const isLoading = isCurrentLevel ? data.isLoading : !cached

  useEffect(() => {
    if (wordCache.has(level)) {
      return
    }

    let cancelled = false
    async function loadWords() {
      try {
        const res = await fetch(`/api/words?level=${level}`)
        const resData = await res.json()
        const fetchedWords: WordItem[] = resData.words || []
        wordCache.set(level, fetchedWords)
        if (!cancelled) {
          setData({ level, words: fetchedWords, isLoading: false })
        }
      } catch (err) {
        console.error("Failed to load words:", err)
        if (!cancelled) {
          setData({ level, words: [], isLoading: false })
        }
      }
    }
    loadWords()
    return () => { cancelled = true }
  }, [level])

  return { words, isLoading }
}
