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
    const onlineUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&type=2`

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current
    audio.pause()
    audio.currentTime = 0

    // In Electron with offline audio package, prioritize local audio file
    const isElectron = typeof window !== "undefined" && Boolean((window as unknown as { electron?: unknown }).electron)
    if (isElectron && !missingLocalAudioSet.has(cleanText)) {
      const localUrl = `/audio/${cleanText}.mp3`
      audio.src = localUrl
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          missingLocalAudioSet.add(cleanText)
          if (audioRef.current) {
            audioRef.current.src = onlineUrl
            audioRef.current.play().catch((fallbackErr) => {
              console.warn("Pronunciation playback failed:", fallbackErr)
            })
          }
        })
      }
    } else {
      // Standard Web: directly stream from Youdao CDN with zero 404 delays
      audio.src = onlineUrl
      audio.play().catch((err) => {
        console.warn("Pronunciation playback failed:", err)
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
