"use client"

import { useCallback, useEffect, useRef } from "react"

export function useSpeech() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // Pre-load and select the best English voice on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const synth = window.speechSynthesis

    const pickVoice = () => {
      const voices = synth.getVoices()
      voiceRef.current =
        voices.find((v) => v.lang === "en-US" && v.name.includes("Google")) ||
        voices.find((v) => v.lang === "en-US" && v.localService === false) ||
        voices.find((v) => v.lang === "en-US") ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0] ||
        null
    }

    pickVoice()
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = pickVoice
    }
  }, [])

  const speak = useCallback((text: string, lang = "en-US") => {
    if (typeof window === "undefined") return
    const synth = window.speechSynthesis

    // Cancel any queued speech
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    if (voiceRef.current) {
      utterance.voice = voiceRef.current
    }

    synth.speak(utterance)

    // Chrome desktop bug: speechSynthesis can get stuck in "speaking=true"
    // state without producing audio. pause()+resume() forces it to start.
    // Wrapped in try-catch as some mobile browsers may throw.
    try {
      synth.pause()
      synth.resume()
    } catch {
      // ignore — mobile browsers may not support this
    }
  }, [])

  const stop = useCallback(() => {
    if (typeof window === "undefined") return
    window.speechSynthesis.cancel()
  }, [])

  return { speak, stop }
}
