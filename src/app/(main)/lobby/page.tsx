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
import { generateQuestions } from "@/lib/questions"
import { useWords } from "@/hooks/useWords"
import { generateId } from "@/lib/utils"
import { sound } from "@/lib/sound"
import type { WordLevel, Question } from "@/types"

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
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playerId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lobbyPlayerId")
      if (saved) return saved
    }
    const id = generateId()
    if (typeof window !== "undefined") localStorage.setItem("lobbyPlayerId", id)
    return id
  })
  const playerIdRef = useRef<string>(playerId)
  const roomRef = useRef<RoomState | null>(null)

  const [activeTab, setActiveTab] = useState<"create" | "join">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("join") || params.get("room")) return "join"
    }
    return "create"
  })
  const [roomId, setRoomId] = useState("")
  const [joinRoomId, setJoinRoomId] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("join") || params.get("room")
      if (code) return code.toUpperCase()
    }
    return ""
  })
  const [room, setRoom] = useState<RoomState | null>(null)
  const [status, setStatus] = useState<"idle" | "creating" | "joining" | "waiting" | "playing">("idle")
  const [error, setError] = useState("")
  const [copyToast, setCopyToast] = useState<string | null>(null)

  const [selectedLevel, setSelectedLevel] = useState<WordLevel>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lobbyLevel") as WordLevel) || "CET4"
    }
    return "CET4"
  })
  const { words } = useWords(selectedLevel)
  const wordsRef = useRef<typeof words>([])
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
      const timer = setTimeout(() => setShowLoginDialog(true), 0)
      return () => clearTimeout(timer)
    }
  }, [user, isLoading])

  // Cleanup channel and timers on unmount
  useEffect(() => {
    return () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current)
      const supabase = getSupabase()
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  const copyToClipboard = (text: string, msg: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopyToast(msg)
        sound.playClick()
        setTimeout(() => setCopyToast(null), 2500)
      })
    }
  }

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

    const updateRoom = (newRoom: RoomState | null) => {
      roomRef.current = newRoom
      setRoom(newRoom)
    }

    channel
      .on("broadcast", { event: "room-update" }, ({ payload }) => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current)
          joinTimeoutRef.current = null
        }
        updateRoom(payload.room)
      })
      .on("broadcast", { event: "game-start" }, ({ payload }) => {
        updateRoom(payload.room)
        setStatus("playing")
      })
      .on("broadcast", { event: "game-started" }, ({ payload }) => {
        if (isHostRef.current) {
          isHostRef.current = false
          return
        }
        const currentRoom = roomRef.current
        const opponent = currentRoom?.players.find((p) => p.id !== playerIdRef.current)?.username || ""
        sound.playGameStart()
        initGame("realtime", selectedLevel, wordsRef.current, payload.totalQuestions, payload.questions)
        router.push(`/game?roomId=${rid}&opponent=${encodeURIComponent(opponent)}`)
      })
      .on("broadcast", { event: "player-left" }, ({ payload }) => {
        updateRoom(payload.room)
        setError("对手已离开房间")
      })
      .on("broadcast", { event: "request-state" }, ({ payload }) => {
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
      .subscribe()

    channelRef.current = channel
    return channel
  }, [initGame, router, selectedLevel])

  const handleCreateRoom = useCallback(async () => {
    if (!user) return
    setStatus("creating")
    sound.playClick()

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

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (channel.state === "joined") {
          clearInterval(check)
          resolve()
        }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 3000)
    })

    await channel.track({
      id: playerIdRef.current,
      username: user.username,
      ready: false,
    })

    await channel.send({
      type: "broadcast",
      event: "room-update",
      payload: { room: newRoom },
    })
  }, [user, subscribeToRoom])

  const handleJoinRoom = useCallback(async () => {
    if (!user || !joinRoomId) return
    setStatus("joining")
    sound.playClick()

    const rid = joinRoomId.toUpperCase().trim()
    setRoomId(rid)

    const channel = subscribeToRoom(rid)

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (channel.state === "joined") {
          clearInterval(check)
          resolve()
        }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 3000)
    })

    await channel.track({
      id: playerIdRef.current,
      username: user.username,
      ready: false,
    })

    await channel.send({
      type: "broadcast",
      event: "request-state",
      payload: { playerId: playerIdRef.current, username: user.username },
    })

    setStatus("waiting")
    setError("")

    joinTimeoutRef.current = setTimeout(() => {
      joinTimeoutRef.current = null
      setError("房间不存在或对手已离线，请检查房间号")
      setStatus("idle")
      if (channelRef.current) {
        const supabase = getSupabase()
        if (supabase) supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setRoom(null)
      setRoomId("")
    }, 5000)
  }, [user, joinRoomId, subscribeToRoom])

  const handleReady = useCallback(async () => {
    if (!channelRef.current || !roomId || !user) return
    sound.playClick()

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

    const questions = generateQuestions(words, 10)
    isHostRef.current = true

    await channelRef.current.send({
      type: "broadcast",
      event: "game-started",
      payload: { questions, totalQuestions: questions.length },
    })

    sound.playGameStart()
    const opponent = room?.players.find((p) => p.id !== playerIdRef.current)?.username || ""
    initGame("realtime", selectedLevel, words, questions.length, questions)
    router.push(`/game?roomId=${roomId}&isHost=true&opponent=${encodeURIComponent(opponent)}`)
  }, [roomId, words, initGame, router, selectedLevel, room])

  const isCurrentUserReady = room?.players.find((p) => p.id === playerId)?.ready ?? false

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted text-sm">连接对战服务器中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-muted mb-4">请先登录后再进入实时对战</p>
        <AlertDialog
          open={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false)
            router.push("/login")
          }}
          title="需要登录"
          description="登录后即可创建或加入对战房间，记录天梯排位！"
          confirmText="前往登录"
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          ⚡ MULTIPLAYER ARENA
        </span>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-ink mt-3 mb-2 tracking-tight">
          实时在线对战
        </h1>
        <p className="text-muted text-sm md:text-base">与好友或同学实时同屏比拼单词储备与手速</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm flex items-center justify-between animate-shake">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-xs underline font-medium">关闭</button>
        </div>
      )}

      {copyToast && (
        <div className="mb-6 p-3 bg-success/15 border border-success/30 rounded-xl text-success text-sm text-center font-medium animate-countdown-pop">
          {copyToast}
        </div>
      )}

      {status === "idle" && (
        <Card className="border-hairline shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-hairline bg-surface-soft/60">
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 py-4 text-center font-medium text-sm transition-all border-b-2 ${
                activeTab === "create"
                  ? "border-primary text-primary font-semibold bg-surface-card"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              👑 创建新房间
            </button>
            <button
              onClick={() => setActiveTab("join")}
              className={`flex-1 py-4 text-center font-medium text-sm transition-all border-b-2 ${
                activeTab === "join"
                  ? "border-primary text-primary font-semibold bg-surface-card"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              🚪 加入已有房间
            </button>
          </div>

          <CardContent className="p-6 md:p-8">
            {activeTab === "create" ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-ink">
                    选择挑战词库级别
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {(["CET4", "CET6", "TOEFL", "IELTS"] as WordLevel[]).map((level) => (
                      <Button
                        key={level}
                        variant={selectedLevel === level ? "primary" : "outline"}
                        size="md"
                        className="py-3 font-medium"
                        onClick={() => setSelectedLevel(level)}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-surface-soft rounded-xl border border-hairline-soft text-xs text-muted space-y-1">
                  <p>• 房间创建后将生成 6 位专属房间码</p>
                  <p>• 发送房间码或链接给好友，双方就绪后立即开战</p>
                </div>

                <Button
                  size="lg"
                  variant="primary"
                  className="w-full text-base py-4 shadow-xs"
                  onClick={handleCreateRoom}
                >
                  🚀 立即创建房间
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-ink">
                    输入 6 位房间码
                  </label>
                  <Input
                    placeholder="如: A9K2F7"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    className="text-center text-2xl font-mono tracking-widest font-bold h-14 bg-surface-soft"
                    maxLength={8}
                    autoFocus
                  />
                </div>

                <Button
                  size="lg"
                  variant="primary"
                  className="w-full text-base py-4 shadow-xs"
                  onClick={handleJoinRoom}
                  disabled={!joinRoomId.trim()}
                >
                  ⚔️ 进入对战房间
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {status === "waiting" && room && (
        <Card className="border-hairline shadow-md overflow-hidden animate-countdown-pop">
          <CardHeader className="bg-surface-soft/60 border-b border-hairline pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">对战房间 #{roomId}</CardTitle>
              <Badge variant={room.players.length === 2 ? "coral" : "info"} className="animate-pulse">
                {room.players.length === 2 ? "双方已入场" : "等待对手加入..."}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Room Code & Share Center */}
            <div className="p-6 bg-surface-dark rounded-2xl text-center text-on-dark space-y-3 relative overflow-hidden">
              <span className="text-xs font-mono text-on-dark-soft tracking-wider">ROOM INVITE CODE</span>
              <p className="font-display text-4xl md:text-5xl font-black tracking-widest text-primary">
                {roomId}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs bg-surface-dark-elevated text-on-dark border-surface-dark-elevated hover:bg-surface-dark-soft"
                  onClick={() => copyToClipboard(roomId, "房间号已复制！")}
                >
                  📋 复制房间号
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs bg-surface-dark-elevated text-on-dark border-surface-dark-elevated hover:bg-surface-dark-soft"
                  onClick={() => {
                    const url = `${window.location.origin}/lobby?join=${roomId}`
                    copyToClipboard(url, "邀请链接已复制到剪贴板！")
                  }}
                >
                  🔗 复制邀请链接
                </Button>
              </div>
            </div>

            {/* Players List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-ink flex items-center justify-between">
                <span>对战玩家 ({room.players.length}/2)</span>
                <span className="text-xs text-muted font-normal">词库：{selectedLevel}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {room.players.map((player) => {
                  const isMe = player.id === playerId
                  return (
                    <div
                      key={player.id}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        player.ready
                          ? "bg-success/10 border-success/30"
                          : "bg-surface-card border-hairline-soft"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-ink">
                            {player.username} {isMe && <span className="text-xs text-muted font-normal">(我)</span>}
                          </p>
                          <p className="text-[11px] text-muted">在线</p>
                        </div>
                      </div>
                      {player.ready ? (
                        <Badge variant="success">✓ 已准备</Badge>
                      ) : (
                        <Badge variant="warning">⏳ 准备中</Badge>
                      )}
                    </div>
                  )
                })}

                {/* Empty slot placeholder */}
                {room.players.length === 1 && (
                  <div className="p-4 rounded-xl border border-dashed border-hairline flex items-center justify-center text-muted text-sm gap-2">
                    <span className="animate-spin text-primary">⚡</span>
                    <span>等待好友进入房间...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-hairline-soft">
              <Button
                variant="primary"
                size="lg"
                className="flex-1 shadow-xs"
                onClick={handleReady}
                disabled={isCurrentUserReady}
              >
                {isCurrentUserReady ? "✅ 我已准备就绪" : "👉 点击准备"}
              </Button>

              {room.players.length === 2 && room.players.every((p) => p.ready) && (
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 bg-success hover:bg-success/90 animate-combo-pulse shadow-md"
                  onClick={handleStartGame}
                >
                  🚀 双方已就绪 · 开战！
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                className="sm:w-32"
                onClick={() => {
                  if (joinTimeoutRef.current) {
                    clearTimeout(joinTimeoutRef.current)
                    joinTimeoutRef.current = null
                  }
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
