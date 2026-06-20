"use client"

import { useCallback, useRef } from "react"

export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined") return

    const cleanText = text.toLowerCase().trim()
    const localUrl = `/audio/${cleanText}.mp3`
    const fallbackUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&type=2`

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    // Stop current audio if playing
    audioRef.current.pause()
    audioRef.current.currentTime = 0

    // Try playing local audio file first
    audioRef.current.src = localUrl

    const playPromise = audioRef.current.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If local file is missing, try online fallback URL
        console.log(`Local audio for "${cleanText}" not found. Trying online fallback...`)
        if (audioRef.current) {
          audioRef.current.src = fallbackUrl
          audioRef.current.play().catch((fallbackErr) => {
            console.warn("Pronunciation playback failed both locally and online:", fallbackErr)
          })
        }
      })
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  return { speak, stop }
}
