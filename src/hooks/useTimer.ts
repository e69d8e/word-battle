"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export function useTimer(durationMs: number, onTimeout?: () => void) {
  const [timeLeft, setTimeLeft] = useState(durationMs)
  const [isRunning, setIsRunning] = useState(false)
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const onTimeoutRef = useRef(onTimeout)
  const updateRef = useRef<() => void>(() => {})

  // Update the ref when onTimeout changes
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const stop = useCallback(() => {
    setIsRunning(false)
    cancelAnimationFrame(rafRef.current)
  }, [])

  // Define update function
  const update = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const remaining = Math.max(0, durationMs - elapsed)
    setTimeLeft(remaining)

    if (remaining <= 0) {
      setIsRunning(false)
      onTimeoutRef.current?.()
      return
    }

    rafRef.current = requestAnimationFrame(updateRef.current)
  }, [durationMs])

  // Store update in ref
  useEffect(() => {
    updateRef.current = update
  }, [update])

  const start = useCallback(() => {
    startTimeRef.current = Date.now()
    setIsRunning(true)
    setTimeLeft(durationMs)
    rafRef.current = requestAnimationFrame(updateRef.current)
  }, [durationMs])

  const reset = useCallback(() => {
    stop()
    setTimeLeft(durationMs)
  }, [durationMs, stop])

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return {
    timeLeft,
    isRunning,
    start,
    stop,
    reset,
    progress: timeLeft / durationMs,
    seconds: Math.ceil(timeLeft / 1000),
  }
}
