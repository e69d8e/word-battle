"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { useGameStore } from "@/stores/gameStore"
import { QuestionCard } from "@/components/game/QuestionCard"
import { ScoreBoard } from "@/components/game/ScoreBoard"
import { Timer } from "@/components/game/Timer"
import { GameResult } from "@/components/game/GameResult"
import { AlertDialog } from "@/components/ui/dialog"
import { getSupabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { generateQuestions } from "@/lib/questions"
import { useWords } from "@/hooks/useWords"
import { sound } from "@/lib/sound"
import { PLAY_TOPIC, resolveGameLevel } from "@/lib/realtime-protocol"
import {
  clearRealtimeSession,
  loadRealtimeSession,
  saveRealtimeSession,
} from "@/lib/realtime-session"
import type { GameMode, WordLevel, GameResult as GameResultType } from "@/types"

export default function GamePage() {
  const { user } = useAuthStore()
  const {
    mode, status, questions, currentIndex,
    score1, score2, combo1, combo2, lastScoreGained1, lastScoreGained2, answers1, answers2,
    initGame, submitAnswer, syncOpponentAnswer, syncOpponentFinished, nextQuestion, finishGame, resetGame
  } = useGameStore()

  const [selectedMode, setSelectedMode] = useState<GameMode>("ai")
  const [selectedLevel, setSelectedLevel] = useState<WordLevel>("CET4")
  const { words, isLoading } = useWords(selectedLevel)
  const wordsRef = useRef(words)
  const selectedLevelRef = useRef(selectedLevel)
  const [matchCountdown, setMatchCountdown] = useState<number | null>(null)

  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    selectedLevelRef.current = selectedLevel
  }, [selectedLevel])

  const [totalQuestions] = useState(10)
  const [timerKey, setTimerKey] = useState(0)
  const [result, setResult] = useState<GameResultType | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showLoadingDialog, setShowLoadingDialog] = useState(false)

  // Realtime channel ref for multiplayer
  const channelRef = useRef<RealtimeChannel | null>(null)
  const roomIdRef = useRef<string | null>(null)
  const opponentAnswersRef = useRef<Record<string, { answer: string; correct: boolean; time: number }>>({})
  const opponentCorrectCountRef = useRef(0)
  const [opponentCorrectCount, setOpponentCorrectCount] = useState(0)
  const opponentUsernameRef = useRef<string>("")
  const selfUsernameRef = useRef<string>("")
  const presenceGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [opponentUsername, setOpponentUsername] = useState<string>("")
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false)
  const [opponentLeft, setOpponentLeft] = useState(false)
  const opponentFinishedRef = useRef(false)
  const selfFinishedRef = useRef(false)

  // Rematch state
  const [isWaitingForRematch, setIsWaitingForRematch] = useState(false)
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false)
  const rematchRequestedRef = useRef(false)
  const opponentRematchRef = useRef(false)
  const isHostRef = useRef(false)
  // Calculate player correct counts with useMemo to avoid recomputing on every timer tick
  const player1CorrectCount = useMemo(
    () => Object.values(answers1).filter((a) => a.correct).length,
    [answers1]
  )
  const player2CorrectCount = useMemo(() => {
    return mode === "realtime"
      ? opponentCorrectCount
      : Object.values(answers2).filter((a) => a.correct).length
  }, [mode, opponentCorrectCount, answers2])

  const player1Info = useMemo(() => ({
    name: user?.username || "玩家1",
    score: score1,
    correctCount: player1CorrectCount,
    combo: combo1,
    lastScoreGained: lastScoreGained1,
    isMe: true,
  }), [user?.username, score1, player1CorrectCount, combo1, lastScoreGained1])

  const player2Info = useMemo(() => ({
    name: mode === "ai" ? "AI 机器人" : (opponentUsername || "玩家2"),
    score: score2,
    correctCount: player2CorrectCount,
    combo: combo2,
    lastScoreGained: lastScoreGained2,
    isMe: false,
  }), [mode, opponentUsername, score2, player2CorrectCount, combo2, lastScoreGained2])

  // Initialize opponent username from URL query param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const opponentParam = urlParams.get("opponent")
      if (opponentParam) {
        const decodedOpponent = decodeURIComponent(opponentParam)
        opponentUsernameRef.current = decodedOpponent
        const timer = setTimeout(() => setOpponentUsername(decodedOpponent), 0)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  // Timer for each question
  const [timeLeft, setTimeLeft] = useState(15)
  const questionTimeLimit = 15
  const timeoutRef = useRef(false)
  const answeredRef = useRef(false) // Track if current question has been answered

  // Pending async work — must be cancelled on unmount / game restart so stale
  // timeouts can't mutate a freshly started game
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAllGameTimers = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = []
  }, [])

  // Opponent's user id (realtime mode) — passed via URL for game saving
  const opponentIdRef = useRef<string>("")
  useEffect(() => {
    const opponentId = new URLSearchParams(window.location.search).get("opponentId")
    if (opponentId) opponentIdRef.current = opponentId
  }, [])

  // Long-lived effects (channel subscription, pagehide) read the username from a
  // ref so they never have to re-run when it changes
  useEffect(() => {
    selfUsernameRef.current = user?.username || ""
  }, [user?.username])

  useEffect(() => {
    return () => clearAllGameTimers()
  }, [clearAllGameTimers])

  // AI answer helper — used by both handleTimeout and handleAnswer
  const getAIAnswer = useCallback(() => {
    const state = useGameStore.getState()
    const q = state.questions[state.currentIndex]
    if (!q) return
    const aiCorrect = Math.random() > 0.3
    const wrongOptions = q.options.filter((o) => o !== q.correctAnswer)
    const aiAnswer = aiCorrect
      ? q.correctAnswer
      : wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
    const aiTime = Math.round((Math.random() * 8 + 2) * 1000)
    submitAnswer(2, aiAnswer || "", aiTime)
  }, [submitAnswer])

  const handleGameEnd = useCallback(() => {
    // Read all state from store to avoid stale closures
    const finalState = useGameStore.getState()
    const finalScore1 = finalState.score1
    const finalScore2 = finalState.score2
    const finalAnswers1 = finalState.answers1
    const finalAnswers2 = finalState.answers2
    const finalMode = finalState.mode
    const finalQuestions = finalState.questions
    const finalWordLevel = finalState.wordLevel

    // For realtime mode, use merged opponent answers
    const opponentAnswers = finalMode === "realtime"
      ? { ...finalAnswers2, ...opponentAnswersRef.current }
      : finalAnswers2

    // Get player usernames (fallback to "玩家" when not logged in)
    const p1Username = user?.username || "玩家"
    const p2Username = finalMode === "realtime"
      ? (opponentUsernameRef.current || opponentUsername || "对手")
      : "AI 机器人"

    const finalMaxCombo1 = finalState.maxCombo1
    const finalMaxCombo2 = finalState.maxCombo2

    const answers1Arr = Object.values(finalAnswers1)
    const answers2Arr = Object.values(opponentAnswers)
    const totalQCount = finalQuestions.length || 10
    const accuracy1 = totalQCount > 0 ? Math.round((answers1Arr.filter((a) => a.correct).length / totalQCount) * 100) : 0
    const accuracy2 = totalQCount > 0 ? Math.round((answers2Arr.filter((a) => a.correct).length / totalQCount) * 100) : 0
    const avgTime1 = answers1Arr.length > 0 ? Number((answers1Arr.reduce((acc, curr) => acc + curr.time, 0) / (answers1Arr.length * 1000)).toFixed(1)) : 0
    const avgTime2 = answers2Arr.length > 0 ? Number((answers2Arr.reduce((acc, curr) => acc + curr.time, 0) / (answers2Arr.length * 1000)).toFixed(1)) : 0

    const isWinner = finalScore1 > finalScore2
    const isLoser = finalScore2 > finalScore1
    if (isWinner) {
      sound.playVictory()
    } else if (isLoser) {
      sound.playDefeat()
    }

    const gameResult: GameResultType = {
      gameId: Date.now().toString(),
      mode: finalMode,
      player1: { username: p1Username, score: finalScore1, maxCombo: finalMaxCombo1, accuracy: accuracy1, avgTime: avgTime1 },
      player2: { username: p2Username, score: finalScore2, maxCombo: finalMaxCombo2, accuracy: accuracy2, avgTime: avgTime2 },
      winner:
        finalScore1 > finalScore2
          ? p1Username
          : finalScore2 > finalScore1
          ? p2Username
          : null,
      questions: finalQuestions.map((q) => ({
        word: q.word.word,
        phonetic: q.word.phonetic,
        meaningCn: q.word.meaningCn,
        meaning: q.word.meaning,
        example: q.word.example,
        type: q.type,
        correct1: finalAnswers1[q.id]?.correct || false,
        correct2: (opponentAnswers as Record<string, { correct: boolean }>)[q.id]?.correct || false,
      })),
    }

    setResult(gameResult)
    setIsWaitingForOpponent(false)

    // Broadcast game end in realtime mode
    if (finalMode === "realtime" && channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-ended",
        payload: { playerId: user.id, score: finalScore1 },
      })
    }

    // Save game to server only if logged in
    if (!user) return

    // In realtime both clients reach this point, so both used to POST the same
    // match (duplicate history entries + doubled career stats). Only the host
    // writes the record, and its payload already carries both scores.
    if (finalMode === "realtime" && !isHostRef.current) return

    fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: finalMode,
        wordLevel: finalWordLevel,
        player1Id: user.id,
        player2Id: finalMode === "realtime" ? opponentIdRef.current || null : null,
        score1: finalScore1,
        score2: finalScore2,
        status: "finished",
        // Idempotency key — a retried save won't create a duplicate game
        clientId: crypto.randomUUID(),
        questions: finalQuestions.map((q) => ({
          type: q.type,
          options: q.options,
          answer1: finalAnswers1[q.id]?.answer,
          answer2: finalMode === "realtime"
            ? (opponentAnswers as Record<string, { answer: string }>)[q.id]?.answer
            : finalAnswers2[q.id]?.answer,
          correct1: finalAnswers1[q.id]?.correct || false,
          correct2: finalMode === "realtime"
            ? (opponentAnswers as Record<string, { correct: boolean }>)[q.id]?.correct || false
            : finalAnswers2[q.id]?.correct || false,
          time1: finalAnswers1[q.id]?.time,
          time2: finalMode === "realtime"
            ? (opponentAnswers as Record<string, { time: number }>)[q.id]?.time
            : finalAnswers2[q.id]?.time,
        })),
      }),
    }).catch((err) => {
      console.error("Failed to save game:", err)
    })
  }, [user, opponentUsername])

  // Advance game: next question or finish — shared by handleTimeout and handleAnswer
  const advanceGame = useCallback((delay: number) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      const state = useGameStore.getState()
      // Read the mode from the store, not the closure: this callback is also
      // resumed right after a reload restores a match (when the captured render
      // still had mode === "ai").
      const liveMode = state.mode
      if (state.currentIndex < state.questions.length - 1) {
        nextQuestion()
        setTimerKey((k) => k + 1)
      } else if (liveMode === "realtime") {
        selfFinishedRef.current = true
        if (channelRef.current && user) {
          channelRef.current.send({
            type: "broadcast",
            event: "player-finished",
            payload: {
              playerId: user.id,
              username: user.username,
              finalScore: state.score1,
              maxCombo: state.maxCombo1,
              answers: state.answers1,
            },
          })
        }
        if (opponentFinishedRef.current) {
          setIsWaitingForOpponent(false)
          finishGame()
          handleGameEnd()
        } else {
          setIsWaitingForOpponent(true)
        }
      } else {
        finishGame()
        handleGameEnd()
      }
    }, delay)
  }, [nextQuestion, finishGame, handleGameEnd, user])

  // Kept in a ref so the mount-only restore effect always calls the newest one
  const advanceGameRef = useRef(advanceGame)
  useEffect(() => {
    advanceGameRef.current = advanceGame
  }, [advanceGame])

  const handleTimeout = useCallback(() => {
    if (answeredRef.current) return
    answeredRef.current = true

    submitAnswer(1, "", questionTimeLimit * 1000)

    // Broadcast timeout answer in realtime mode
    if (mode === "realtime" && channelRef.current && user) {
      const state = useGameStore.getState()
      const q = state.questions[state.currentIndex]
      if (q) {
        channelRef.current.send({
          type: "broadcast",
          event: "answer-submitted",
          payload: {
            playerId: user.id,
            username: user.username,
            questionId: q.id,
            answer: "",
            timeMs: questionTimeLimit * 1000,
            isCorrect: false,
          },
        })
      }
    }

    if (mode === "ai") getAIAnswer()

    advanceGame(1000)
  }, [mode, submitAnswer, getAIAnswer, advanceGame, user])

  // A page reload wipes the in-memory store, which used to strand the player on
  // the mode picker while the opponent kept waiting. Read the resume point after
  // mount (never during render: server and client markup must match) and put the
  // match back together.
  const [booting, setBooting] = useState(true)

  /* eslint-disable react-hooks/set-state-in-effect -- one-shot boot probe: the
     resume point can only be read after mount, and the resulting state must be
     applied in the same pass for the match to come back in one frame */
  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get("roomId")
    if (!roomId) {
      setBooting(false)
      return
    }

    const snapshot = loadRealtimeSession(roomId)
    const store = useGameStore.getState()
    // A live navigation already initialised the match — the snapshot is stale
    if (!snapshot || store.status !== "waiting" || store.questions.length > 0) {
      if (snapshot) clearRealtimeSession(roomId)
      setBooting(false)
      return
    }

    isHostRef.current = snapshot.isHost
    opponentIdRef.current = snapshot.opponentId
    if (snapshot.opponentUsername) {
      opponentUsernameRef.current = snapshot.opponentUsername
      setOpponentUsername(snapshot.opponentUsername)
    }
    opponentAnswersRef.current = snapshot.answers2
    const opponentCorrect = Object.values(snapshot.answers2).filter((a) => a.correct).length
    opponentCorrectCountRef.current = opponentCorrect
    setOpponentCorrectCount(opponentCorrect)
    opponentFinishedRef.current = false

    // A reload can land inside the short post-answer pause, before the finish was
    // broadcast — recover that from the answers instead of trusting the flag
    const answeredAll = snapshot.questions.every((q) => !!snapshot.answers1[q.id])
    const resumedFinished = snapshot.selfFinished || answeredAll
    selfFinishedRef.current = resumedFinished

    useGameStore.getState().restoreGame({
      mode: "realtime",
      wordLevel: snapshot.wordLevel,
      questions: snapshot.questions,
      currentIndex: snapshot.currentIndex,
      score1: snapshot.score1,
      score2: snapshot.score2,
      combo1: snapshot.combo1,
      combo2: snapshot.combo2,
      maxCombo1: snapshot.maxCombo1,
      maxCombo2: snapshot.maxCombo2,
      lastScoreGained1: snapshot.lastScoreGained1,
      lastScoreGained2: snapshot.lastScoreGained2,
      answers1: snapshot.answers1,
      answers2: snapshot.answers2,
      // The per-question clock starts over: we were offline for an unknown while
      startTime: Date.now(),
      questionStartTime: Date.now(),
    })

    if (resumedFinished) {
      setIsWaitingForOpponent(true)
    } else if (snapshot.answers1[snapshot.questions[snapshot.currentIndex].id]) {
      answeredRef.current = true
      advanceGameRef.current(1200)
    }

    setTimerKey((k) => k + 1)
    setBooting(false)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep a resume point while the match is being played; drop it as soon as the
  // match is over (a finished match is not resumable).
  useEffect(() => {
    if (mode !== "realtime") return
    // Read the room id from the URL rather than from roomIdRef: this effect is
    // declared before the channel effect that fills that ref
    const roomId = new URLSearchParams(window.location.search).get("roomId")
    if (!roomId) return

    const persist = (state: ReturnType<typeof useGameStore.getState>) => {
      if (state.mode !== "realtime" || state.status !== "playing") {
        clearRealtimeSession(roomId)
        return
      }
      saveRealtimeSession({
        roomId,
        savedAt: Date.now(),
        isHost: isHostRef.current,
        wordLevel: state.wordLevel,
        questions: state.questions,
        currentIndex: state.currentIndex,
        score1: state.score1,
        score2: state.score2,
        combo1: state.combo1,
        combo2: state.combo2,
        maxCombo1: state.maxCombo1,
        maxCombo2: state.maxCombo2,
        lastScoreGained1: state.lastScoreGained1,
        lastScoreGained2: state.lastScoreGained2,
        answers1: state.answers1,
        answers2: state.answers2,
        opponentId: opponentIdRef.current,
        opponentUsername: opponentUsernameRef.current,
        selfFinished: selfFinishedRef.current,
      })
    }

    persist(useGameStore.getState())
    const unsubscribe = useGameStore.subscribe(persist)
    return () => {
      unsubscribe()
      // Unmounting the match page (menu / leave) invalidates the resume point.
      // A real page unload does not run cleanup, so reloads still resume.
      clearRealtimeSession(roomId)
    }
  }, [mode])

  const resetAllRematchState = useCallback(() => {
    rematchRequestedRef.current = false
    opponentRematchRef.current = false
    setIsWaitingForRematch(false)
    setOpponentWantsRematch(false)
    opponentAnswersRef.current = {}
    opponentCorrectCountRef.current = 0
    setOpponentCorrectCount(0)
    setIsWaitingForOpponent(false)
    setOpponentLeft(false)
    opponentFinishedRef.current = false
    selfFinishedRef.current = false
  }, [])

  const startRematch = useCallback(() => {
    console.log("[Rematch] Starting rematch, isHost:", isHostRef.current)
    clearAllGameTimers()
    resetAllRematchState()

    if (isHostRef.current) {
      if (wordsRef.current.length < 10) {
        console.error("[Rematch] Not enough words")
        return
      }
      const presetQuestions = generateQuestions(wordsRef.current, totalQuestions)

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "game-started",
          payload: { questions: presetQuestions, totalQuestions, wordLevel: selectedLevelRef.current },
        })
      }

      resetGame()
      setResult(null)
      setTimerKey((k) => k + 1)
      initGame("realtime", selectedLevelRef.current, wordsRef.current, totalQuestions, presetQuestions)
    }
  }, [totalQuestions, initGame, resetGame, clearAllGameTimers, resetAllRematchState])

  const startRematchRef = useRef(startRematch)
  useEffect(() => {
    startRematchRef.current = startRematch
  }, [startRematch])

  // Channel handlers must reach handleGameEnd through a ref: putting the
  // callback itself in the channel effect's deps would tear down and
  // re-subscribe the channel mid-game (it changes when opponentUsername does).
  const handleGameEndRef = useRef(handleGameEnd)
  useEffect(() => {
    handleGameEndRef.current = handleGameEnd
  }, [handleGameEnd])

  // The opponent is gone (closed the tab, navigated away, lost the socket).
  // Broadcasts alone cannot notice a dropped peer, so this is driven by presence
  // leave + the player-left broadcast. It aborts the match instead of leaving
  // the player stuck on an overlay that never resolves.
  const handleOpponentGone = useCallback(
    (name?: string) => {
      const state = useGameStore.getState()
      if (state.mode !== "realtime") return

      // Never keep waiting for a rematch with a player who left
      rematchRequestedRef.current = false
      opponentRematchRef.current = false
      setIsWaitingForRematch(false)
      setOpponentWantsRematch(false)

      // A finished match already shows its result screen — nothing to abort
      if (state.status !== "playing") return

      clearAllGameTimers()
      setIsWaitingForOpponent(false)
      setOpponentLeft(true)
      if (name) setOpponentUsername(name)
    },
    [clearAllGameTimers]
  )

  const handleOpponentGoneRef = useRef(handleOpponentGone)
  useEffect(() => {
    handleOpponentGoneRef.current = handleOpponentGone
  }, [handleOpponentGone])

  const leaveRealtimeGame = useCallback(() => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "player-left",
        payload: { playerId: user.id, username: user.username },
      })
    }
    if (roomIdRef.current) clearRealtimeSession(roomIdRef.current)
    clearAllGameTimers()
    resetAllRematchState()
    resetGame()
    setResult(null)
    window.location.href = "/lobby"
  }, [user, clearAllGameTimers, resetAllRematchState, resetGame])

  // Subscribe to realtime channel for multiplayer answer sync
  useEffect(() => {
    if (mode !== "realtime") return

    const supabase = getSupabase()
    if (!supabase) {
      console.error("[Realtime] Supabase client not available")
      return
    }

    // Get room ID and host flag from URL params
    const urlParams = new URLSearchParams(window.location.search)
    const roomId = urlParams.get("roomId")
    const isHostParam = urlParams.get("isHost")

    console.log("[Realtime] URL search:", window.location.search)
    console.log("[Realtime] Room ID:", roomId, "isHost:", isHostParam)

    if (!roomId) {
      console.error("[Realtime] No room ID found")
      return
    }

    roomIdRef.current = roomId
    isHostRef.current = isHostParam === "true"
    // Gameplay gets its own topic: sharing `room:{id}` with the lobby would make
    // the lobby's presence leave (fired during the hand-off to the game page)
    // look like the opponent dropping out.
    const channelName = PLAY_TOPIC(roomId)
    const currentUserId = user?.id
    console.log("[Realtime] Creating channel:", channelName, "isHost:", isHostRef.current, "user:", currentUserId)

    // Configure channel to receive own broadcast events
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        // Presence needs an opt-in (config flag or a binding registered before
        // subscribe); we rely on it to notice a peer whose tab died.
        presence: { enabled: true, key: currentUserId || "anonymous" },
      },
    })

    console.log("[Realtime] Current user ID:", currentUserId)

    channel
      .on("broadcast", { event: "answer-submitted" }, ({ payload }) => {
        console.log("[Realtime] Received answer-submitted from playerId:", payload.playerId, "currentUserId:", currentUserId)
        // Receive opponent's answer - check if it's from a different player
        if (payload.playerId !== currentUserId) {
          const { questionId, answer, timeMs, isCorrect, username } = payload
          // Store opponent's username
          if (username && !opponentUsernameRef.current) {
            opponentUsernameRef.current = username
            setOpponentUsername(username)
          }
          // Store opponent's answer by question ID
          opponentAnswersRef.current[questionId] = { answer, correct: isCorrect, time: timeMs }
          // Update opponent's correct count
          if (isCorrect) {
            opponentCorrectCountRef.current += 1
            setOpponentCorrectCount(opponentCorrectCountRef.current)
          }

          // Score/combo are recomputed locally inside the store (remote totals are not trusted)
          syncOpponentAnswer({
            questionId,
            answer,
            isCorrect,
            timeMs,
          })
        }
      })
      .on("broadcast", { event: "player-finished" }, ({ payload }) => {
        console.log("[Realtime] Received player-finished from playerId:", payload.playerId, "currentUserId:", currentUserId, "selfFinished:", selfFinishedRef.current)
        // Handle opponent finishing all questions - check if it's from a different player
        if (payload.playerId !== currentUserId) {
          console.log("[Realtime] Opponent finished!")
          opponentFinishedRef.current = true

          if (payload.username && !opponentUsernameRef.current) {
            opponentUsernameRef.current = payload.username
            setOpponentUsername(payload.username)
          }

          if (payload.answers) {
            opponentAnswersRef.current = {
              ...opponentAnswersRef.current,
              ...payload.answers,
            }
          }

          syncOpponentFinished({
            answers: payload.answers,
          })

          // If self also finished, proceed to game end
          if (selfFinishedRef.current) {
            console.log("[Realtime] Both finished, ending game")
            setIsWaitingForOpponent(false)
            finishGame()
            handleGameEndRef.current()
          } else {
            console.log("[Realtime] Waiting for self to finish")
          }
        } else {
          console.log("[Realtime] Ignoring own player-finished event")
        }
      })
      .on("broadcast", { event: "game-ended" }, ({ payload }) => {
        console.log("[Realtime] Received game-ended from playerId:", payload.playerId, "currentUserId:", currentUserId)
        // Handle opponent ending the game
        if (payload.playerId !== currentUserId) {
          console.log("Opponent ended the game")
        }
      })
      .on("broadcast", { event: "rematch-requested" }, ({ payload }) => {
        console.log("[Realtime] Received rematch-requested from playerId:", payload.playerId, "currentUserId:", currentUserId)
        if (payload.playerId !== currentUserId) {
          opponentRematchRef.current = true
          setOpponentWantsRematch(true)
          // If self also requested rematch, start the new game
          if (rematchRequestedRef.current) {
            console.log("[Realtime] Both players want rematch, starting new game")
            startRematchRef.current()
          }
        }
      })
      .on("broadcast", { event: "game-started" }, ({ payload }) => {
        console.log("[Realtime] Received game-started (rematch), isHost:", isHostRef.current)
        // Joiner receives new questions from host during rematch
        if (!isHostRef.current && payload.questions) {
          const { questions: presetQuestions, totalQuestions: total, wordLevel: level } = payload
          resetAllRematchState()
          resetGame()
          setResult(null)
          setTimerKey((k) => k + 1)
          initGame("realtime", resolveGameLevel(level, selectedLevelRef.current), wordsRef.current, total, presetQuestions)
        }
      })
      .on("broadcast", { event: "player-left" }, ({ payload }) => {
        console.log("[Realtime] Received player-left from playerId:", payload.playerId, "currentUserId:", currentUserId)
        if (payload.playerId !== currentUserId) {
          // Opponent left: cancels a pending rematch and aborts an in-flight match
          handleOpponentGoneRef.current(payload.username)
        }
      })
      // Presence callbacks must be registered before subscribe(). A leave here is
      // the only signal we get when the opponent's tab dies without a broadcast.
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (!currentUserId || key === currentUserId) return
        const left = leftPresences?.[0]
        console.log("[Realtime] Opponent presence left:", left?.username ?? key)
        // A dropped socket re-joins and re-tracks automatically, so only treat
        // this as a real departure if the opponent is still gone after a moment.
        // The window is generous on purpose: a page reload closes the socket too,
        // and the reloaded tab must be able to come back before we abort.
        if (presenceGraceTimerRef.current) clearTimeout(presenceGraceTimerRef.current)
        presenceGraceTimerRef.current = setTimeout(() => {
          presenceGraceTimerRef.current = null
          if (channel.presenceState()[key]?.length) return
          handleOpponentGoneRef.current(left?.username)
        }, 10_000)
      })
      // The opponent came back (reload/reconnect) — resume instead of leaving them
      // staring at a "match aborted" overlay
      .on("presence", { event: "join" }, ({ key }) => {
        if (!currentUserId || key === currentUserId) return
        if (presenceGraceTimerRef.current) {
          clearTimeout(presenceGraceTimerRef.current)
          presenceGraceTimerRef.current = null
        }
        console.log("[Realtime] Opponent presence (re)joined", key)
        setOpponentLeft(false)
      })
      // A client that (re)joined asks for the current peer state so a reload does
      // not lose answers that were broadcast while it was away
      .on("broadcast", { event: "request-game-state" }, ({ payload }) => {
        if (!currentUserId || payload?.playerId === currentUserId) return
        const state = useGameStore.getState()
        if (state.mode !== "realtime") return
        channel.send({
          type: "broadcast",
          event: "game-state",
          payload: {
            playerId: currentUserId,
            username: selfUsernameRef.current,
            answers: state.answers1,
            finished: selfFinishedRef.current,
          },
        })
      })
      .on("broadcast", { event: "game-state" }, ({ payload }) => {
        if (!currentUserId || payload?.playerId === currentUserId) return
        if (useGameStore.getState().mode !== "realtime") return
        console.log("[Realtime] Received game-state, finished:", payload.finished)
        if (payload.username && !opponentUsernameRef.current) {
          opponentUsernameRef.current = payload.username
          setOpponentUsername(payload.username)
        }
        // Only the answer map is used; the score is recomputed locally
        syncOpponentFinished({ answers: payload.answers })
        if (payload.finished) {
          opponentFinishedRef.current = true
          if (selfFinishedRef.current) {
            setIsWaitingForOpponent(false)
            finishGame()
            handleGameEndRef.current()
          }
        } else if (selfFinishedRef.current) {
          setIsWaitingForOpponent(true)
        }
      })
      .subscribe((status, err) => {
        console.log("[Realtime] Channel subscription status:", status)
        if (err) {
          console.error("[Realtime] Subscription error:", err)
        }
        // Track after subscribing so the opponent can detect us leaving. This also
        // re-runs on automatic rejoins, restoring presence after a network blip.
        if (status === "SUBSCRIBED" && currentUserId) {
          channel
            .track({ id: currentUserId, username: selfUsernameRef.current })
            .catch((trackErr) => console.warn("[Realtime] Presence track failed:", trackErr))

          // Catch up on anything broadcast while we were away (reload/reconnect)
          channel.send({
            type: "broadcast",
            event: "request-game-state",
            payload: { playerId: currentUserId },
          })

          // If we had already finished before the reload, make sure the opponent
          // knows it — otherwise they wait for a finish that never arrives
          if (selfFinishedRef.current) {
            const state = useGameStore.getState()
            channel.send({
              type: "broadcast",
              event: "player-finished",
              payload: {
                playerId: currentUserId,
                username: selfUsernameRef.current,
                finalScore: state.score1,
                maxCombo: state.maxCombo1,
                answers: state.answers1,
              },
            })
          }
        }
      })

    channelRef.current = channel

    return () => {
      if (presenceGraceTimerRef.current) {
        clearTimeout(presenceGraceTimerRef.current)
        presenceGraceTimerRef.current = null
      }
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
    // Deps are intentionally minimal: every callback used by the handlers is a
    // stable store action or reads from refs. Including volatile callbacks here
    // (e.g. handleGameEnd, which changes when opponentUsername changes) would
    // tear down and re-subscribe the channel mid-game, dropping broadcasts.
  }, [mode, user?.id, finishGame, initGame, resetGame, resetAllRematchState, syncOpponentAnswer, syncOpponentFinished])

  const currentQuestion = questions[currentIndex]
  const hasAnswered = currentQuestion ? !!answers1[currentQuestion.id] : false

  useEffect(() => {
    if (status !== "playing" || hasAnswered || opponentLeft) return

    timeoutRef.current = false
    answeredRef.current = false
    // Reset timer when question changes
    setTimeLeft(questionTimeLimit) // eslint-disable-line react-hooks/set-state-in-effect

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          timeoutRef.current = true
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentIndex, status, timerKey, hasAnswered, opponentLeft])

  // Handle timeout separately to avoid setState during render
  useEffect(() => {
    if (timeLeft === 0 && timeoutRef.current && status === "playing") {
      timeoutRef.current = false
      handleTimeout()
    }
  }, [timeLeft, status, handleTimeout])

  // Safety: game finished but result never got set (e.g. saving crashed) —
  // reset in an effect; calling a store setter during render is impure and can
  // double-fire under StrictMode / concurrent rendering.
  useEffect(() => {
    if (status === "finished" && !result) {
      clearAllGameTimers()
      resetGame()
    }
  }, [status, result, resetGame, clearAllGameTimers])

  const handleAnswer = useCallback(
    (answer: string, timeMs: number) => {
      if (answeredRef.current) return
      answeredRef.current = true

      submitAnswer(1, answer, timeMs)

      // Broadcast answer to opponent in realtime mode
      if (mode === "realtime" && channelRef.current && user) {
        const state = useGameStore.getState()
        const q = state.questions[state.currentIndex]

        if (q) {
          channelRef.current.send({
            type: "broadcast",
            event: "answer-submitted",
            payload: {
              playerId: user.id,
              username: user.username,
              questionId: q.id,
              answer,
              timeMs,
              isCorrect: state.answers1[q.id]?.correct || false,
            },
          })
        }
      }

      if (mode === "ai") {
        if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
        aiTimerRef.current = setTimeout(() => {
          aiTimerRef.current = null
          getAIAnswer()
        }, 500)
      }

      advanceGame(1500)
    },
    [mode, submitAnswer, getAIAnswer, advanceGame, user]
  )

  const startGame = () => {
    if (selectedMode === "realtime") {
      if (!user) {
        setShowLoginDialog(true)
        return
      }
      window.location.href = "/lobby"
      return
    }

    if (words.length < 10) {
      setShowLoadingDialog(true)
      return
    }

    resetAllRematchState()
    clearAllGameTimers()
    opponentUsernameRef.current = ""
    opponentIdRef.current = ""
    setOpponentUsername("")
    resetGame()
    setResult(null)

    // Run exciting 3-2-1 countdown before starting round
    setMatchCountdown(3)
    sound.playCountdownTick(false)

    const timers: ReturnType<typeof setTimeout>[] = []
    countdownTimersRef.current = timers
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => {
        fn()
      }, ms))
    }

    later(() => {
      setMatchCountdown(2)
      sound.playCountdownTick(false)

      later(() => {
        setMatchCountdown(1)
        sound.playCountdownTick(false)

        later(() => {
          setMatchCountdown(0) // "GO!"
          sound.playCountdownTick(true)

          later(() => {
            countdownTimersRef.current = []
            setMatchCountdown(null)
            setTimerKey((k) => k + 1)
            initGame(selectedMode, selectedLevel, words, totalQuestions)
          }, 500)
        }, 750)
      }, 750)
    }, 750)
  }

  const playAgain = () => {
    // For realtime mode, use rematch flow instead of navigating to lobby
    if (mode === "realtime" && channelRef.current && user) {
      rematchRequestedRef.current = true
      setIsWaitingForRematch(true)

      channelRef.current.send({
        type: "broadcast",
        event: "rematch-requested",
        payload: { playerId: user.id },
      })

      if (opponentRematchRef.current) {
        startRematch()
      }
      return
    }

    // AI mode: start directly
    setResult(null)
    startGame()
  }

  // Hydration-safe boot gate: the resume point is read after mount, so the first
  // paint must not depend on it (server and client markup have to match)
  if (booting) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">加载中...</p>
      </div>
    )
  }

  // Mode selection screen
  if (status === "waiting" && !result && matchCountdown === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-2 tracking-tight">选择对战模式</h1>
        <p className="text-center text-muted mb-12">选择你喜欢的模式开始挑战</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {[
            {
              mode: "ai" as GameMode,
              icon: "🤖",
              title: "人机对战",
              desc: "与AI进行单词PK，适合单人练习",
              accent: "bg-accent-teal",
            },
            {
              mode: "realtime" as GameMode,
              icon: "⚡",
              title: "实时对战",
              desc: "邀请好友实时PK，比拼速度",
              accent: "bg-primary",
            },
            {
              mode: "async" as GameMode,
              icon: "📨",
              title: "异步挑战",
              desc: "发起挑战，好友随时应战",
              accent: "bg-surface-dark",
              disabled: true,
            },
          ].map((item) => (
            <Card
              key={item.mode}
              className={`cursor-pointer transition-all hover:shadow-subtle ${
                selectedMode === item.mode ? "ring-2 ring-primary shadow-subtle" : ""
              } ${item.disabled ? "opacity-60" : ""}`}
              onClick={() => !item.disabled && setSelectedMode(item.mode)}
            >
              <CardContent className="p-8 text-center">
                <div className={`w-16 h-16 mx-auto mb-5 ${item.accent} rounded-lg flex items-center justify-center text-3xl`}>
                  {item.icon}
                </div>
                <h3 className="font-display text-lg font-medium mb-2 text-ink">{item.title}</h3>
                <p className="text-sm text-muted mb-3">{item.desc}</p>
                {item.disabled && (
                  <Badge variant="warning">即将上线</Badge>
                )}
                {selectedMode === item.mode && !item.disabled && (
                  <Badge variant="coral">已选择</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Word Level Selection */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle>选择词汇级别</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { level: "CET4" as WordLevel, name: "CET-4", desc: "大学英语四级" },
                { level: "CET6" as WordLevel, name: "CET-6", desc: "大学英语六级" },
                { level: "TOEFL" as WordLevel, name: "TOEFL", desc: "托福词汇" },
                { level: "IELTS" as WordLevel, name: "IELTS", desc: "雅思词汇" },
              ].map((item) => (
                <Button
                  key={item.level}
                  variant={selectedLevel === item.level ? "primary" : "outline"}
                  className="h-auto py-4 flex-col"
                  onClick={() => setSelectedLevel(item.level)}
                >
                  <span className="font-display text-lg font-medium">{item.name}</span>
                  <span className="text-xs mt-1 opacity-70">{item.desc}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Start Button */}
        <div className="text-center">
          <Button
            size="lg"
            variant="primary"
            className="text-lg px-12 py-4"
            onClick={startGame}
            disabled={isLoading || words.length < 10}
          >
            {isLoading ? "加载单词中..." : "🚀 开始挑战"}
          </Button>
          <p className="text-sm text-muted mt-3">
            共 {totalQuestions} 题 · 每题 {questionTimeLimit} 秒 · 支持全键盘快捷键
          </p>
        </div>

        <AlertDialog
          open={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false)
            window.location.href = "/login"
          }}
          title="提示"
          description="请先登录后再进行实时对战"
          confirmText="去登录"
        />
        <AlertDialog
          open={showLoadingDialog}
          onClose={() => setShowLoadingDialog(false)}
          title="提示"
          description="单词库加载中，请稍候..."
          confirmText="知道了"
        />
      </div>
    )
  }

  // Pre-game 3-2-1 countdown screen
  if (matchCountdown !== null) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted text-lg tracking-wider uppercase font-medium">对战即将开始</p>
          <div
            key={matchCountdown}
            className="w-32 h-32 md:w-40 md:h-40 mx-auto rounded-full bg-gradient-to-tr from-primary to-accent-amber text-on-primary flex items-center justify-center text-6xl md:text-7xl font-display font-black shadow-lg animate-countdown-pop"
          >
            {matchCountdown === 0 ? "GO!" : matchCountdown}
          </div>
          <p className="text-sm text-muted-soft font-mono">准备好按下按键 A / B / C / D</p>
        </div>
      </div>
    )
  }

  // Game result screen
  if (status === "finished" && result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <GameResult
          result={result}
          currentUsername={user?.username}
          onPlayAgain={playAgain}
          onBackToMenu={() => {
            // Notify opponent before leaving
            if (mode === "realtime" && channelRef.current && user) {
              channelRef.current.send({
                type: "broadcast",
                event: "player-left",
                payload: { playerId: user.id },
              })
            }
            if (roomIdRef.current) clearRealtimeSession(roomIdRef.current)
            clearAllGameTimers()
            resetAllRematchState()
            resetGame()
            setResult(null)
          }}
          isWaitingForRematch={isWaitingForRematch}
          opponentWantsRematch={opponentWantsRematch}
        />
      </div>
    )
  }

  // Safety: game finished but result not set — go back to menu
  if (status === "finished" && !result) return null

  // Game playing screen
  if (!currentQuestion) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Opponent left mid-match — abort instead of hanging forever */}
      {opponentLeft && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs flex items-center justify-center z-50 animate-countdown-pop">
          <Card className="max-w-sm mx-4">
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-4xl">🚪</div>
              <h3 className="font-display text-lg font-medium text-ink">对手已离开对局</h3>
              <p className="text-muted text-sm">
                {opponentUsername || "对手"} 已断开连接，本局不计入战绩。
              </p>
              <Button variant="primary" size="lg" className="w-full" onClick={leaveRealtimeGame}>
                返回对战大厅
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Waiting for opponent overlay */}
      {isWaitingForOpponent && !opponentLeft && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 animate-countdown-pop">
          <Card className="max-w-sm mx-4">
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <h3 className="font-display text-lg font-medium text-ink mb-2">等待对手完成</h3>
              <p className="text-muted text-sm">你已完成所有题目，正在等待对手最后一击...</p>
              <p className="text-xs text-muted-soft mt-3">
                {opponentUsername || "对手"} 可能已离线，可继续等待或退出本局
              </p>
              <Button
                variant="outline"
                size="md"
                className="w-full mt-4"
                onClick={leaveRealtimeGame}
              >
                退出本局
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Board */}
      <div className="mb-6">
        <ScoreBoard
          player1={player1Info}
          player2={player2Info}
          currentQuestion={currentIndex + 1}
          totalQuestions={questions.length}
        />
      </div>

      {/* Timer */}
      <div className="flex justify-center mb-6">
        <Timer
          seconds={timeLeft}
          total={questionTimeLimit}
        />
      </div>

      {/* Question */}
      <Card className="shadow-sm border-hairline bg-surface-card/95 backdrop-blur-sm">
        <CardContent className="p-6 md:p-8">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            onAnswer={handleAnswer}
            disabled={status !== "playing" || opponentLeft}
          />
        </CardContent>
      </Card>
    </div>
  )
}
