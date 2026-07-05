"use client"

import { useState, useEffect } from "react"
import type { WordLevel, WordItem } from "@/types"

export function useWords(level: WordLevel) {
  const [words, setWords] = useState<WordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadWords() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/words?level=${level}`)
        const data = await res.json()
        if (!cancelled) setWords(data.words || [])
      } catch (err) {
        console.error("Failed to load words:", err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadWords()
    return () => { cancelled = true }
  }, [level])

  return { words, isLoading }
}
