"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertDialog } from "@/components/ui/dialog"
import { useAuthStore } from "@/stores/authStore"
import { useGameStore } from "@/stores/gameStore"
import { getSupabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { WordLevel, WordItem, Question, QuestionType } from "@/types"

interface Player {
  id: string
  username: string
  ready: boolean
}

interface RoomState {
  id: string
  players: Player[]
  status: "waiting" | "playing" | "finished"
  questions?: Question[]
}

export default function LobbyPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { initGame } = useGameStore()

  const channelRef = useRef<RealtimeChannel | null>(null)

  // Restore playerId from localStorage to survive page navigation
  const [playerId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lobbyPlayerId")
      if (saved) return saved
    }
    const id = crypto.randomUUID()
    if (typeof window !== "undefined") localStorage.setItem("lobbyPlayerId", id)
    return id
  })
  const playerIdRef = useRef<string>(playerId)
  const roomRef = useRef<RoomState | null>(null)

  const [roomId, setRoomId] = useState("")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [room, setRoom] = useState<RoomState | null>(null)
  const [status, setStatus] = useState<"idle" | "creating" | "joining" | "waiting" | "playing">("idle")
  const [error, setError] = useState("")
  const [selectedLevel, setSelectedLevel] = useState<WordLevel>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lobbyLevel") as WordLevel) || "CET4"
    }
    return "CET4"
  })
  const [words, setWords] = useState<WordItem[]>([])
  const wordsRef = useRef<WordItem[]>([])
  const isHostRef = useRef(false)

  // Keep wordsRef in sync
  useEffect(() => {
    wordsRef.current = words
  }, [words])

  // Persist selectedLevel to localStorage
  useEffect(() => {
    localStorage.setItem("lobbyLevel", selectedLevel)
  }, [selectedLevel])

  // Redirect to login if not authenticated
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const { isLoading } = useAuthStore()
  useEffect(() => {
    if (!isLoading && !user) {
      setShowLoginDialog(true)
    }
  }, [user, isLoading])

  // Load words
  useEffect(() => {
    async function loadWords() {
      try {
        const res = await fetch(`/api/words?level=${selectedLevel}`)
        const data = await res.json()
        setWords(data.words || [])
      } catch (err) {
        console.error("Failed to load words:", err)
      }
    }
    loadWords()
  }, [selectedLevel])

  // Cleanup channel on unmount
  useEffect(() => {
    return () => {
      const supabase = getSupabase()
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  const subscribeToRoom = useCallback((rid: string) => {
    const supabase = getSupabase()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const channel = supabase.channel(`room:${rid}`, {
      config: {
        presence: { key: playerIdRef.current },
        broadcast: { self: true },
      },
    })

    // Helper to update both state and ref
    const updateRoom = (newRoom: RoomState | null) => {
      roomRef.current = newRoom
      setRoom(newRoom)
    }

    channel
      .on("broadcast", { event: "room-update" }, ({ payload }) => {
        updateRoom(payload.room)
      })
      .on("broadcast", { event: "game-start" }, ({ payload }) => {
        updateRoom(payload.room)
        setStatus("playing")
      })
      .on("broadcast", { event: "game-started" }, ({ payload }) => {
        // Skip if this client is the host (already initialized locally in handleStartGame)
        if (isHostRef.current) {
          isHostRef.current = false
          return
        }
        initGame("realtime", selectedLevel, wordsRef.current, payload.totalQuestions, payload.questions)
        router.push(`/game?roomId=${rid}`)
      })
      .on("broadcast", { event: "player-left" }, ({ payload }) => {
        updateRoom(payload.room)
        setError("对手已离开房间")
      })
      .on("broadcast", { event: "request-state" }, ({ payload }) => {
        // Host responds to state requests, adding the new player
        const currentRoom = roomRef.current
        if (currentRoom) {
          const playerExists = currentRoom.players.some((p) => p.id === payload.playerId)
          const updatedRoom = playerExists
            ? currentRoom
            : {
                ...currentRoom,
                players: [
                  ...currentRoom.players,
                  { id: payload.playerId, username: payload.username, ready: false },
                ],
              }
          updateRoom(updatedRoom)
          channel.send({
            type: "broadcast",
            event: "room-update",
            payload: { room: updatedRoom },
          })
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Player>()
        console.log("Presence sync:", state)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log(`Subscribed to room:${rid}`)
        }
      })

    channelRef.current = channel
    return channel
  }, [initGame, router, selectedLevel])

  const handleCreateRoom = useCallback(async () => {
    if (!user) return
    setStatus("creating")

    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    const newRoom: RoomState = {
      id: newRoomId,
      players: [{ id: playerIdRef.current, username: user.username, ready: false }],
      status: "waiting",
    }

    setRoomId(newRoomId)
    roomRef.current = newRoom
    setRoom(newRoom)
    setStatus("waiting")

    const channel = subscribeToRoom(newRoomId)

    // Track presence
    await channel.track({
      id: playerIdRef.current,
      username: user.username,
      ready: false,
    })

    // Broadcast room creation
    await channel.send({
      type: "broadcast",
      event: "room-update",
      payload: { room: newRoom },
    })
  }, [user, subscribeToRoom])

  const handleJoinRoom = useCallback(async () => {
    if (!user || !joinRoomId) return
    setStatus("joining")

    const rid = joinRoomId.toUpperCase()
    setRoomId(rid)

    const channel = subscribeToRoom(rid)

    // Wait for subscription to be ready
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (channel.state === "joined") {
          clearInterval(check)
          resolve()
        }
      }, 100)
      // Timeout after 3 seconds
      setTimeout(() => { clearInterval(check); resolve() }, 3000)
    })

    // Track presence
    await channel.track({
      id: playerIdRef.current,
      username: user.username,
      ready: false,
    })

    // Request room state from host
    await channel.send({
      type: "broadcast",
      event: "request-state",
      payload: { playerId: playerIdRef.current, username: user.username },
    })

    setStatus("waiting")
    setError("")
  }, [user, joinRoomId, subscribeToRoom])

  const handleReady = useCallback(async () => {
    if (!channelRef.current || !roomId || !user) return

    const updatedPlayers = room?.players.map((p) =>
      p.id === playerIdRef.current ? { ...p, ready: true } : p
    ) || []

    const updatedRoom: RoomState = {
      ...room!,
      players: updatedPlayers,
    }

    roomRef.current = updatedRoom
    setRoom(updatedRoom)

    await channelRef.current.send({
      type: "broadcast",
      event: "room-update",
      payload: { room: updatedRoom },
    })
  }, [roomId, user, room])

  const handleStartGame = useCallback(async () => {
    if (!channelRef.current || !roomId || words.length < 10) return

    // Select random questions
    const shuffled = [...words].sort(() => Math.random() - 0.5)
    const selectedWords = shuffled.slice(0, 10)
    const questions: Question[] = selectedWords.map((word) => {
      const types: QuestionType[] = ["en2cn", "cn2en", "listening"]
      const type = types[Math.floor(Math.random() * types.length)]
      let correctAnswer: string
      let options: string[]

      if (type === "en2cn") {
        correctAnswer = word.meaningCn
        const otherMeanings = [...new Set(
          words.filter((w) => w.id !== word.id).map((w) => w.meaningCn)
        )]
        options = [correctAnswer, ...otherMeanings.sort(() => Math.random() - 0.5).slice(0, 3)]
      } else if (type === "cn2en") {
        correctAnswer = word.word
        const otherWords = [...new Set(
          words.filter((w) => w.id !== word.id).map((w) => w.word)
        )]
        options = [correctAnswer, ...otherWords.sort(() => Math.random() - 0.5).slice(0, 3)]
      } else {
        correctAnswer = word.word
        const otherWords = [...new Set(
          words.filter((w) => w.id !== word.id).map((w) => w.word)
        )]
        options = [correctAnswer, ...otherWords.sort(() => Math.random() - 0.5).slice(0, 3)]
      }

      // Deduplicate and ensure minimum 4 options
      options = [...new Set(options)]
      while (options.length < 4) {
        options.push(`选项${options.length + 1}`)
      }

      // Shuffle options
      options = options.sort(() => Math.random() - 0.5)

      return {
        id: word.id + "-" + type,
        word,
        type,
        options,
        correctAnswer,
      }
    })

    // Mark as host before broadcasting so the broadcast handler skips re-init
    isHostRef.current = true

    // Broadcast game start
    await channelRef.current.send({
      type: "broadcast",
      event: "game-started",
      payload: { questions, totalQuestions: questions.length },
    })

    // Also start locally with the same preset questions
    initGame("realtime", selectedLevel, words, questions.length, questions)
    // Navigate to game with room ID and host flag in URL
    router.push(`/game?roomId=${roomId}&isHost=true`)
  }, [roomId, words, initGame, router, selectedLevel])

  // Compute derived state outside of JSX to avoid ref access during render
  const isCurrentUserReady = room?.players.find((p) => p.id === playerId)?.ready ?? false

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted">加载中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted">请先登录</p>
        <AlertDialog
          open={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false)
            router.push("/login")
          }}
          title="提示"
          description="请先登录后再进入实时对战"
          confirmText="去登录"
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-2 tracking-tight">实时对战</h1>
      <p className="text-center text-muted mb-12">创建或加入房间，与好友实时PK</p>

      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error">
          {error}
        </div>
      )}

      {status === "idle" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Create Room */}
          <Card>
            <CardHeader>
              <CardTitle>创建房间</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted mb-5">创建一个新房间，邀请好友加入</p>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2 text-body-strong">词汇级别</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["CET4", "CET6", "TOEFL", "IELTS"] as WordLevel[]).map((level) => (
                    <Button
                      key={level}
                      variant={selectedLevel === level ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setSelectedLevel(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateRoom}
                disabled={status !== "idle"}
              >
                创建房间
              </Button>
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card>
            <CardHeader>
              <CardTitle>加入房间</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted mb-5">输入房间号加入对战</p>
              <div className="mb-5">
                <Input
                  placeholder="输入房间号"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleJoinRoom}
                disabled={!joinRoomId || status !== "idle"}
              >
                加入房间
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {status === "waiting" && room && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>房间: {roomId}</span>
              <Badge variant="info">等待对手</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <h3 className="font-medium mb-2 text-ink">房间号</h3>
                <div className="p-5 bg-surface-dark rounded-lg text-center">
                  <span className="font-display text-4xl font-medium tracking-widest text-on-dark">{roomId}</span>
                  <p className="text-sm text-on-dark-soft mt-2">分享此房间号给好友</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2 text-ink">玩家列表</h3>
                <div className="space-y-2">
                  {room.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-surface-card rounded-lg"
                    >
                      <span className="text-ink">{player.username}</span>
                      {player.ready ? (
                        <Badge variant="success">已准备</Badge>
                      ) : (
                        <Badge variant="warning">未准备</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  className="flex-1"
                  onClick={handleReady}
                  disabled={isCurrentUserReady}
                >
                  准备
                </Button>
                {room.players.length === 2 &&
                  room.players.every((p) => p.ready) && (
                    <Button className="flex-1" onClick={handleStartGame}>
                      开始游戏
                    </Button>
                  )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (channelRef.current) {
                      const supabase = getSupabase()
                      if (supabase) supabase.removeChannel(channelRef.current)
                      channelRef.current = null
                    }
                    setRoom(null)
                    setRoomId("")
                    setStatus("idle")
                  }}
                >
                  离开房间
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
