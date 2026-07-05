"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import type { GameMode, WordLevel, GameResult as GameResultType } from "@/types"

export default function GamePage() {
  const { user } = useAuthStore()
  const {
    mode, status, questions, currentIndex,
    score1, score2, answers1,
    initGame, submitAnswer, nextQuestion, finishGame, resetGame
  } = useGameStore()

  const [selectedMode, setSelectedMode] = useState<GameMode>("ai")
  const [selectedLevel, setSelectedLevel] = useState<WordLevel>("CET4")
  const { words, isLoading } = useWords(selectedLevel)
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
  const [opponentUsername, setOpponentUsername] = useState<string>("")
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false)
  const opponentFinishedRef = useRef(false)
  const selfFinishedRef = useRef(false)

  // Rematch state
  const [isWaitingForRematch, setIsWaitingForRematch] = useState(false)
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false)
  const rematchRequestedRef = useRef(false)
  const opponentRematchRef = useRef(false)
  const isHostRef = useRef(false)

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
    const aiTime = (Math.random() * 8 + 2) * 1000
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

    // For realtime mode, use opponent answers from broadcast
    const opponentAnswers = finalMode === "realtime" ? opponentAnswersRef.current : finalAnswers2

    // Get player usernames (fallback to "玩家" when not logged in)
    const p1Username = user?.username || "玩家"
    const p2Username = finalMode === "realtime"
      ? (opponentUsernameRef.current || "对手")
      : "AI 机器人"

    const gameResult: GameResultType = {
      gameId: Date.now().toString(),
      mode: finalMode,
      player1: { username: p1Username, score: finalScore1 },
      player2: { username: p2Username, score: finalScore2 },
      winner:
        finalScore1 > finalScore2
          ? p1Username
          : finalScore2 > finalScore1
          ? p2Username
          : null,
      questions: finalQuestions.map((q) => ({
        word: q.word.word,
        type: q.type,
        correct1: finalAnswers1[q.id]?.correct || false,
        correct2: finalMode === "realtime"
          ? (opponentAnswers as Record<string, { correct: boolean }>)[q.id]?.correct || false
          : finalAnswers2[q.id]?.correct || false,
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

    fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: finalMode,
        wordLevel: finalWordLevel,
        player1Id: user.id,
        score1: finalScore1,
        score2: finalScore2,
        status: "finished",
        questions: finalQuestions.map((q) => ({
          wordId: q.word.id,
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
  }, [user])

  // Advance game: next question or finish — shared by handleTimeout and handleAnswer
  const advanceGame = useCallback((delay: number) => {
    setTimeout(() => {
      const state = useGameStore.getState()
      if (state.currentIndex < state.questions.length - 1) {
        nextQuestion()
        setTimerKey((k) => k + 1)
      } else if (mode === "realtime") {
        selfFinishedRef.current = true
        if (channelRef.current && user) {
          channelRef.current.send({
            type: "broadcast",
            event: "player-finished",
            payload: { playerId: user.id, username: user.username },
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
  }, [mode, nextQuestion, finishGame, handleGameEnd, user])

  const handleTimeout = useCallback(() => {
    if (answeredRef.current) return
    answeredRef.current = true

    submitAnswer(1, "", questionTimeLimit * 1000)

    // Broadcast timeout answer in realtime mode
    if (mode === "realtime" && channelRef.current && user) {
      const state = useGameStore.getState()
      const q = state.questions[state.currentIndex]
      channelRef.current.send({
        type: "broadcast",
        event: "answer-submitted",
        payload: {
          playerId: user.id,
          username: user.username,
          questionId: q?.id,
          answer: "",
          timeMs: questionTimeLimit * 1000,
          isCorrect: false,
          score: 0,
        },
      })
    }

    if (mode === "ai") getAIAnswer()

    advanceGame(1000)
  }, [mode, submitAnswer, getAIAnswer, advanceGame, user])

  const resetAllRematchState = () => {
    rematchRequestedRef.current = false
    opponentRematchRef.current = false
    setIsWaitingForRematch(false)
    setOpponentWantsRematch(false)
    opponentAnswersRef.current = {}
    opponentCorrectCountRef.current = 0
    setOpponentCorrectCount(0)
    setIsWaitingForOpponent(false)
    opponentFinishedRef.current = false
    selfFinishedRef.current = false
  }

  const startRematch = () => {
    console.log("[Rematch] Starting rematch, isHost:", isHostRef.current)
    resetAllRematchState()

    if (isHostRef.current) {
      if (words.length < 10) {
        console.error("[Rematch] Not enough words")
        return
      }
      const presetQuestions = generateQuestions(words, totalQuestions)

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "game-started",
          payload: { questions: presetQuestions, totalQuestions },
        })
      }

      resetGame()
      setResult(null)
      setTimerKey((k) => k + 1)
      initGame("realtime", selectedLevel, words, totalQuestions, presetQuestions)
    }
  }

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
    const channelName = `room:${roomId}`
    console.log("[Realtime] Creating channel:", channelName, "isHost:", isHostRef.current)

    // Configure channel to receive own broadcast events
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
      },
    })

    // Store current user ID for comparison
    const currentUserId = user?.id
    console.log("[Realtime] Current user ID:", currentUserId)

    channel
      .on("broadcast", { event: "answer-submitted" }, ({ payload }) => {
        console.log("[Realtime] Received answer-submitted from playerId:", payload.playerId, "currentUserId:", currentUserId)
        // Receive opponent's answer - check if it's from a different player
        if (payload.playerId !== currentUserId) {
          const { questionId, answer, timeMs, isCorrect, score, username } = payload
          console.log("[Realtime] Processing opponent answer, isCorrect:", isCorrect)
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
          // Update opponent's score in the store
          const currentScore = useGameStore.getState().score2
          useGameStore.getState().updateScore(2, currentScore + score)
        }
      })
      .on("broadcast", { event: "player-finished" }, ({ payload }) => {
        console.log("[Realtime] Received player-finished from playerId:", payload.playerId, "currentUserId:", currentUserId, "selfFinished:", selfFinishedRef.current)
        // Handle opponent finishing all questions - check if it's from a different player
        if (payload.playerId !== currentUserId) {
          console.log("[Realtime] Opponent finished!")
          opponentFinishedRef.current = true
          // If self also finished, proceed to game end
          if (selfFinishedRef.current) {
            console.log("[Realtime] Both finished, ending game")
            setIsWaitingForOpponent(false)
            finishGame()
            handleGameEnd()
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
            startRematch()
          }
        }
      })
      .on("broadcast", { event: "game-started" }, ({ payload }) => {
        console.log("[Realtime] Received game-started (rematch), isHost:", isHostRef.current)
        // Joiner receives new questions from host during rematch
        if (!isHostRef.current && payload.questions) {
          const { questions: presetQuestions, totalQuestions: total } = payload
          resetAllRematchState()
          resetGame()
          setResult(null)
          setTimerKey((k) => k + 1)
          initGame("realtime", selectedLevel, words, total, presetQuestions)
        }
      })
      .on("broadcast", { event: "player-left" }, ({ payload }) => {
        console.log("[Realtime] Received player-left from playerId:", payload.playerId, "currentUserId:", currentUserId)
        if (payload.playerId !== currentUserId) {
          // Opponent left — cancel rematch waiting
          if (rematchRequestedRef.current) {
            rematchRequestedRef.current = false
            opponentRematchRef.current = false
            setIsWaitingForRematch(false)
            setOpponentWantsRematch(false)
          }
        }
      })
      .subscribe((status, err) => {
        console.log("[Realtime] Channel subscription status:", status)
        if (err) {
          console.error("[Realtime] Subscription error:", err)
        }
      })

    channelRef.current = channel

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [mode, user?.id, finishGame, handleGameEnd])

  const currentQuestion = questions[currentIndex]
  const hasAnswered = currentQuestion ? !!answers1[currentQuestion.id] : false

  useEffect(() => {
    if (status !== "playing" || hasAnswered) return

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
  }, [currentIndex, status, timerKey, hasAnswered])

  // Handle timeout separately to avoid setState during render
  useEffect(() => {
    if (timeLeft === 0 && timeoutRef.current && status === "playing") {
      timeoutRef.current = false
      handleTimeout()
    }
  }, [timeLeft, status, handleTimeout])

  const handleAnswer = useCallback(
    (answer: string, timeMs: number) => {
      if (answeredRef.current) return
      answeredRef.current = true

      const isCorrect = submitAnswer(1, answer, timeMs)

      // Broadcast answer to opponent in realtime mode
      if (mode === "realtime" && channelRef.current && user) {
        const state = useGameStore.getState()
        const q = state.questions[state.currentIndex]
        const baseScore = isCorrect ? 100 : 0
        const timeBonus = isCorrect ? Math.max(0, Math.floor((15000 - timeMs) / 100)) : 0
        const totalScore = baseScore + timeBonus

        channelRef.current.send({
          type: "broadcast",
          event: "answer-submitted",
          payload: {
            playerId: user.id,
            username: user.username,
            questionId: q?.id,
            answer,
            timeMs,
            isCorrect,
            score: totalScore,
          },
        })
      }

      if (mode === "ai") {
        setTimeout(() => getAIAnswer(), 500)
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
    opponentUsernameRef.current = ""
    setOpponentUsername("")
    resetGame()
    setResult(null)
    setTimerKey((k) => k + 1)
    initGame(selectedMode, selectedLevel, words, totalQuestions)
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

  // Mode selection screen
  if (status === "waiting" && !result) {
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
            共 {totalQuestions} 题 · 每题 {questionTimeLimit} 秒
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
  if (status === "finished" && !result) {
    resetGame()
    return null
  }

  // Game playing screen
  if (!currentQuestion) return null

  // Calculate player1 correct count from store
  const answers2 = useGameStore.getState().answers2
  const player1CorrectCount = Object.values(answers1).filter((a) => a.correct).length
  const player2CorrectCount = mode === "realtime"
    ? opponentCorrectCount
    : Object.values(answers2).filter((a) => a.correct).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Waiting for opponent overlay */}
      {isWaitingForOpponent && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <Card className="max-w-sm mx-4">
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <h3 className="font-display text-lg font-medium text-ink mb-2">等待对手完成</h3>
              <p className="text-muted">你已完成所有题目，正在等待对手...</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Board */}
      <div className="mb-6">
        <ScoreBoard
          player1={{ name: user?.username || "玩家1", score: score1, correctCount: player1CorrectCount, isMe: true }}
          player2={{
            name: mode === "ai" ? "AI 机器人" : (opponentUsername || "玩家2"),
            score: score2,
            correctCount: player2CorrectCount,
            isMe: false,
          }}
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
      <Card>
        <CardContent className="p-8">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            onAnswer={handleAnswer}
            disabled={status !== "playing"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
