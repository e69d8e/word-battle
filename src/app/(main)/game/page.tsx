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
import type { GameMode, WordLevel, WordItem, GameResult as GameResultType } from "@/types"

export default function GamePage() {
  const { user } = useAuthStore()
  const {
    mode, status, questions, currentIndex,
    score1, score2,
    initGame, submitAnswer, nextQuestion, finishGame, resetGame
  } = useGameStore()

  const [words, setWords] = useState<WordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState<GameMode>("ai")
  const [selectedLevel, setSelectedLevel] = useState<WordLevel>("CET4")
  const [totalQuestions] = useState(10)
  const [timerKey, setTimerKey] = useState(0)
  const [result, setResult] = useState<GameResultType | null>(null)

  // Load words
  useEffect(() => {
    async function loadWords() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/words?level=${selectedLevel}`)
        const data = await res.json()
        setWords(data.words || [])
      } catch (err) {
        console.error("Failed to load words:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadWords()
  }, [selectedLevel])

  // Timer for each question
  const [timeLeft, setTimeLeft] = useState(15)
  const questionTimeLimit = 15
  const timeoutRef = useRef(false)
  const answeredRef = useRef(false) // Track if current question has been answered

  const handleGameEnd = useCallback(async () => {
    if (!user) return

    // Read all state from store to avoid stale closures
    const finalState = useGameStore.getState()
    const finalScore1 = finalState.score1
    const finalScore2 = finalState.score2
    const finalAnswers1 = finalState.answers1
    const finalAnswers2 = finalState.answers2
    const finalMode = finalState.mode
    const finalQuestions = finalState.questions

    const gameResult: GameResultType = {
      gameId: Date.now().toString(),
      mode: finalMode,
      player1: { username: user.username, score: finalScore1 },
      player2: { username: finalMode === "ai" ? "AI 机器人" : "玩家2", score: finalScore2 },
      winner:
        finalScore1 > finalScore2
          ? user.username
          : finalScore2 > finalScore1
          ? finalMode === "ai" ? "AI 机器人" : "玩家2"
          : null,
      questions: finalQuestions.map((q) => ({
        word: q.word.word,
        type: q.type,
        correct1: finalAnswers1[q.id]?.correct || false,
        correct2: finalAnswers2[q.id]?.correct || false,
      })),
    }

    setResult(gameResult)

    // Save game to server
    try {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: finalMode,
          wordLevel: selectedLevel,
          player1Id: user.id,
          score1: finalScore1,
          score2: finalScore2,
          status: "finished",
          questions: finalQuestions.map((q) => ({
            wordId: q.word.id,
            type: q.type,
            options: q.options,
            answer1: finalAnswers1[q.id]?.answer,
            answer2: finalAnswers2[q.id]?.answer,
            correct1: finalAnswers1[q.id]?.correct || false,
            correct2: finalAnswers2[q.id]?.correct || false,
            time1: finalAnswers1[q.id]?.time,
            time2: finalAnswers2[q.id]?.time,
          })),
        }),
      })
    } catch (err) {
      console.error("Failed to save game:", err)
    }
  }, [user, selectedLevel])

  const handleTimeout = useCallback(() => {
    // Skip if already answered
    if (answeredRef.current) return
    answeredRef.current = true

    // Auto submit empty answer on timeout
    submitAnswer(1, "", questionTimeLimit * 1000)

    if (mode === "ai") {
      // AI answers
      const state = useGameStore.getState()
      const q = state.questions[state.currentIndex]
      const aiCorrect = Math.random() > 0.3
      const wrongOptions = q?.options.filter((o) => o !== q.correctAnswer) || []
      const aiAnswer = aiCorrect
        ? q?.correctAnswer
        : wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
      submitAnswer(2, aiAnswer || "", (Math.random() * 5 + 3) * 1000)
    }

    // Move to next question or finish after a delay
    setTimeout(() => {
      const state = useGameStore.getState()
      if (state.currentIndex < state.questions.length - 1) {
        nextQuestion()
        setTimerKey((k) => k + 1)
      } else {
        finishGame()
        handleGameEnd()
      }
    }, 1000)
  }, [mode, submitAnswer, nextQuestion, finishGame, handleGameEnd])

  useEffect(() => {
    if (status !== "playing") return

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
  }, [currentIndex, status, timerKey])

  // Handle timeout separately to avoid setState during render
  useEffect(() => {
    if (timeLeft === 0 && timeoutRef.current && status === "playing") {
      timeoutRef.current = false
      handleTimeout()
    }
  }, [timeLeft, status, handleTimeout])

  const handleAnswer = useCallback(
    (answer: string, timeMs: number) => {
      // Skip if already answered (e.g., timeout fired first)
      if (answeredRef.current) return
      answeredRef.current = true

      submitAnswer(1, answer, timeMs)

      if (mode === "ai") {
        // AI answers after a delay
        setTimeout(() => {
          const state = useGameStore.getState()
          const q = state.questions[state.currentIndex]
          const aiCorrect = Math.random() > 0.3
          const wrongOptions = q?.options.filter((o) => o !== q.correctAnswer) || []
          const aiAnswer = aiCorrect
            ? q?.correctAnswer
            : wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
          const aiTime = (Math.random() * 8 + 2) * 1000
          submitAnswer(2, aiAnswer || "", aiTime)
        }, 500)
      }

      // Move to next question after a delay
      setTimeout(() => {
        const state = useGameStore.getState()
        if (state.currentIndex < state.questions.length - 1) {
          nextQuestion()
          setTimerKey((k) => k + 1)
        } else {
          finishGame()
          handleGameEnd()
        }
      }, 1500)
    },
    [mode, submitAnswer, nextQuestion, finishGame, handleGameEnd]
  )

  const startGame = () => {
    if (selectedMode === "realtime") {
      // Navigate to lobby for realtime mode
      window.location.href = "/lobby"
      return
    }

    if (words.length < 10) {
      alert("单词库加载中，请稍候...")
      return
    }
    resetGame()
    setResult(null)
    setTimerKey((k) => k + 1)
    initGame(selectedMode, selectedLevel, words, totalQuestions)
  }

  const playAgain = () => {
    setResult(null)
    startGame()
  }

  // Mode selection screen
  if (status === "waiting" && !result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">选择对战模式</h1>
        <p className="text-center text-gray-500 mb-10">选择你喜欢的模式开始挑战</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            {
              mode: "ai" as GameMode,
              icon: "🤖",
              title: "人机对战",
              desc: "与AI进行单词PK，适合单人练习",
              color: "from-green-400 to-emerald-500",
            },
            {
              mode: "realtime" as GameMode,
              icon: "⚡",
              title: "实时对战",
              desc: "邀请好友实时PK，比拼速度",
              color: "from-blue-400 to-cyan-500",
            },
            {
              mode: "async" as GameMode,
              icon: "📨",
              title: "异步挑战",
              desc: "发起挑战，好友随时应战",
              color: "from-purple-400 to-pink-500",
              disabled: true,
            },
          ].map((item) => (
            <Card
              key={item.mode}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedMode === item.mode ? "ring-2 ring-blue-500 shadow-lg" : ""
              } ${item.disabled ? "opacity-60" : ""}`}
              onClick={() => !item.disabled && setSelectedMode(item.mode)}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-4xl`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{item.desc}</p>
                {item.disabled && (
                  <Badge variant="warning">即将上线</Badge>
                )}
                {selectedMode === item.mode && !item.disabled && (
                  <Badge variant="info">已选择</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Word Level Selection */}
        <Card className="mb-8">
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
                  <span className="text-lg font-bold">{item.name}</span>
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
          <p className="text-sm text-gray-400 mt-3">
            共 {totalQuestions} 题 · 每题 {questionTimeLimit} 秒
          </p>
        </div>
      </div>
    )
  }

  // Game result screen
  if (status === "finished" && result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <GameResult
          result={result}
          currentUsername={user?.username}
          onPlayAgain={playAgain}
          onBackToMenu={() => {
            resetGame()
            setResult(null)
          }}
        />
      </div>
    )
  }

  // Game playing screen
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Score Board */}
      <div className="mb-6">
        <ScoreBoard
          player1={{ name: user?.username || "玩家1", score: score1 }}
          player2={{ name: mode === "ai" ? "AI 机器人" : "玩家2", score: score2 }}
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
        <CardContent className="p-6">
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
