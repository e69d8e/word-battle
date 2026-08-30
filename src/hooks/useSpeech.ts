"use client"

import { useCallback, useRef, useEffect } from "react"

const missingLocalAudioSet = new Set<string>()

export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !text) return

    const cleanText = text.toLowerCase().trim()
    const fallbackUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&type=2`
    const localUrl = `/audio/${cleanText}.mp3`

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current
    audio.pause()
    audio.currentTime = 0

    // If we already know local file is missing, jump straight to fallback
    if (missingLocalAudioSet.has(cleanText)) {
      audio.src = fallbackUrl
      audio.play().catch((err) => console.warn("Online audio play error:", err))
      return
    }

    audio.src = localUrl
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        missingLocalAudioSet.add(cleanText)
        if (audioRef.current) {
          audioRef.current.src = fallbackUrl
          audioRef.current.play().catch((fallbackErr) => {
            console.warn("Pronunciation playback failed:", fallbackErr)
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
