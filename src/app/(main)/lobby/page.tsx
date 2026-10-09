"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { sound } from "@/lib/sound"
import {
  ROOM_TOPIC,
  decideJoinRequest,
  dropPlayerFromRoom,
  mergeReadyFlags,
  parsePlayerLeftPayload,
  resolveGameLevel,
  shouldHandleRoomFull,
} from "@/lib/realtime-protocol"
import { isRoomLevel, isValidRoomCode, normalizeRoomCode } from "@/lib/rooms"
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

function LobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const { initGame } = useGameStore()

  const channelRef = useRef<RealtimeChannel | null>(null)
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Join handshake state: we keep re-asking the host until it acknowledges us
  const joinRetryRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const awaitingRoomStateRef = useRef(false)
  const presenceGraceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Set when the host starts the match: presence leaves after this point are just
  // the hand-off from the lobby channel to the game channel
  const gameStartingRef = useRef(false)

  const playerId = user?.id || ""
  const playerIdRef = useRef<string>(playerId)
  const roomRef = useRef<RoomState | null>(null)

  const initialJoinCode = (searchParams.get("join") || searchParams.get("room") || "").toUpperCase()
  const [activeTab, setActiveTab] = useState<"create" | "join">(() => (initialJoinCode ? "join" : "create"))
  const [roomId, setRoomId] = useState("")
  const [joinRoomId, setJoinRoomId] = useState(() => initialJoinCode)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [status, setStatus] = useState<"idle" | "creating" | "joining" | "waiting" | "playing">("idle")
  const [error, setError] = useState("")
  const [copyToast, setCopyToast] = useState<string | null>(null)

  const [selectedLevel, setSelectedLevel] = useState<WordLevel>("CET4")
  // Level actually reserved for the room we are in (the host decides it)
  const [roomLevel, setRoomLevel] = useState<WordLevel | null>(null)
  const roomLevelRef = useRef<WordLevel | null>(null)
  const { words } = useWords(selectedLevel)
  const wordsRef = useRef<typeof words>([])

  // Keep wordsRef and playerIdRef in sync
  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    playerIdRef.current = playerId
  }, [playerId])

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
      if (joinRetryRef.current) clearInterval(joinRetryRef.current)
      presenceGraceTimersRef.current.forEach(clearTimeout)
      presenceGraceTimersRef.current = []
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

  const stopJoinAttempt = useCallback(() => {
    awaitingRoomStateRef.current = false
    if (joinRetryRef.current) {
      clearInterval(joinRetryRef.current)
      joinRetryRef.current = null
    }
  }, [])

  const subscribeToRoom = useCallback((rid: string) => {
    const supabase = getSupabase()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const channel = supabase.channel(ROOM_TOPIC(rid), {
      config: {
        // Presence needs an opt-in: the client only joins a topic with presence
        // enabled when config.presence.enabled is true *or* a presence binding was
        // registered before subscribe(). We do both (see the leave handler below).
        presence: { enabled: true, key: playerIdRef.current },
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
        // Stop re-asking once the host has actually put us in the room
        if (payload.room?.players?.some((p: Player) => p.id === playerIdRef.current)) {
          stopJoinAttempt()
        }
        updateRoom(mergeReadyFlags(roomRef.current, payload.room))
      })
      .on("broadcast", { event: "game-start" }, ({ payload }) => {
        updateRoom(payload.room)
        setStatus("playing")
      })
      .on("broadcast", { event: "game-started" }, ({ payload }) => {
        // Host is always room.players[0] — ignore the echo of our own broadcast
        const currentRoom = roomRef.current
        if (currentRoom?.players[0]?.id === playerIdRef.current) return
        // Match is starting: a presence leave now is the host closing its lobby
        // channel to hand over to the game channel, not an opponent dropping out
        gameStartingRef.current = true
        stopJoinAttempt()
        const opponent = currentRoom?.players.find((p) => p.id !== playerIdRef.current)
        sound.playGameStart()
        // Play (and save) the level the host actually picked, not our own
        const level = resolveGameLevel(payload.wordLevel, roomLevelRef.current ?? selectedLevel)
        initGame("realtime", level, wordsRef.current, payload.totalQuestions, payload.questions)
        const opponentParams = opponent
          ? `&opponent=${encodeURIComponent(opponent.username)}&opponentId=${encodeURIComponent(opponent.id)}`
          : ""
        router.push(`/game?roomId=${rid}&wordLevel=${level}${opponentParams}`)
      })
      .on("broadcast", { event: "player-left" }, ({ payload }) => {
        const { room: nextRoom, username } = parsePlayerLeftPayload(payload, roomRef.current)
        if (nextRoom) updateRoom(nextRoom)
        setError(`${username || "对手"} 已离开房间`)
      })
      .on("broadcast", { event: "request-state" }, ({ payload }) => {
        const decision = decideJoinRequest({
          room: roomRef.current,
          myPlayerId: playerIdRef.current,
          requesterId: payload.playerId,
          requesterName: payload.username,
        })
        if (decision.action === "ignore") return
        if (decision.action === "full") {
          // Room is full — tell the joiner instead of silently adding a 3rd player
          channel.send({
            type: "broadcast",
            event: "room-full",
            payload: { roomId: decision.room.id, senderId: playerIdRef.current },
          })
          return
        }
        updateRoom(decision.room)
        channel.send({
          type: "broadcast",
          event: "room-update",
          payload: { room: decision.room },
        })
      })
      .on("broadcast", { event: "room-full" }, ({ payload }) => {
        // `broadcast: { self: true }` echoes our own messages back: without this
        // guard the host (and the other member in the room) would kick
        // themselves out of their own room whenever a third player tried to join.
        if (!shouldHandleRoomFull({
          payloadSenderId: payload?.senderId,
          myPlayerId: playerIdRef.current,
          awaitingRoomState: awaitingRoomStateRef.current,
        })) {
          return
        }
        stopJoinAttempt()
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current)
          joinTimeoutRef.current = null
        }
        setError("房间已满（2 人），无法加入")
        setStatus("idle")
        const supabase = getSupabase()
        if (channelRef.current && supabase) {
          supabase.removeChannel(channelRef.current)
        }
        channelRef.current = null
        setRoom(null)
        setRoomId("")
      })
      // Presence leave is the only signal we get when a peer's tab dies while we
      // are waiting. presence callbacks must be registered before subscribe().
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (gameStartingRef.current) return
        if (key === playerIdRef.current) return
        const left = (leftPresences?.[0] ?? null) as { id?: string; username?: string } | null
        const leftId = left?.id ?? key
        // A transient socket drop auto-rejoins: only drop the player if presence
        // is still empty after a short grace period.
        const timer = setTimeout(() => {
          if (gameStartingRef.current) return
          if (channel.presenceState()[leftId]?.length) return
          // Only drop the player if presence is still empty after the grace period
          const nextRoom = dropPlayerFromRoom(roomRef.current, leftId)
          if (!nextRoom) return
          updateRoom(nextRoom)
          setError(`${left?.username || "对手"} 已离开房间`)
        }, 3000)
        presenceGraceTimersRef.current.push(timer)
      })
      .subscribe()

    channelRef.current = channel
    return channel
  }, [initGame, router, selectedLevel, stopJoinAttempt])

  const handleCreateRoom = useCallback(async () => {
    if (!user) return
    setStatus("creating")
    sound.playClick()
    setError("")

    // The code is allocated by the server (unique index) so two hosts can never
    // end up in the same channel by accident
    let newRoomId: string
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.room?.code) {
        setError(data?.error || "房间创建失败，请稍后重试")
        setStatus("idle")
        return
      }
      newRoomId = data.room.code as string
    } catch {
      setError("网络异常，房间创建失败")
      setStatus("idle")
      return
    }

    roomLevelRef.current = selectedLevel
    setRoomLevel(selectedLevel)

    const newRoom: RoomState = {
      id: newRoomId,
      players: [{ id: playerIdRef.current, username: user.username, ready: false }],
      status: "waiting",
    }

    setRoomId(newRoomId)
    roomRef.current = newRoom
    setRoom(newRoom)
    setStatus("waiting")
    gameStartingRef.current = false

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
  }, [user, subscribeToRoom, selectedLevel])

  const handleJoinRoom = useCallback(async () => {
    if (!user || !joinRoomId) return
    setStatus("joining")
    sound.playClick()
    setError("")

    const rid = normalizeRoomCode(joinRoomId)
    if (!isValidRoomCode(rid)) {
      setError("房间号格式不正确，请检查后重试")
      setStatus("idle")
      return
    }

    // Reserve the seat server-side before touching realtime, so a full/expired/
    // unknown room is refused instead of half-joined
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rid }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "加入房间失败，请稍后重试")
        setStatus("idle")
        return
      }
      if (isRoomLevel(data?.room?.level)) {
        roomLevelRef.current = data.room.level
        setRoomLevel(data.room.level)
      }
    } catch {
      setError("网络异常，加入房间失败")
      setStatus("idle")
      return
    }

    setRoomId(rid)
    gameStartingRef.current = false
    awaitingRoomStateRef.current = true

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

    const requestState = () =>
      channel.send({
        type: "broadcast",
        event: "request-state",
        payload: { playerId: playerIdRef.current, username: user.username },
      })

    await requestState()

    // Re-ask while we wait: one lost broadcast used to leave the host holding a
    // phantom player (or the joiner timing out against a perfectly healthy room)
    joinRetryRef.current = setInterval(() => {
      if (!awaitingRoomStateRef.current) {
        if (joinRetryRef.current) {
          clearInterval(joinRetryRef.current)
          joinRetryRef.current = null
        }
        return
      }
      if (channel.state !== "joined") return
      requestState()
    }, 1500)

    setStatus("waiting")
    setError("")

    joinTimeoutRef.current = setTimeout(() => {
      joinTimeoutRef.current = null
      stopJoinAttempt()
      // Tell the host in case it already added us before the reply was lost
      channel.send({
        type: "broadcast",
        event: "player-left",
        payload: { playerId: playerIdRef.current, username: user.username },
      })
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
  }, [user, joinRoomId, subscribeToRoom, stopJoinAttempt])

  // Fire-and-forget: the reservation is a convenience, the realtime channel is
  // what actually plays the match
  const releaseRoomReservation = useCallback((code: string) => {
    if (!code) return
    fetch("/api/rooms/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => {})
  }, [])

  const handleReady = useCallback(async () => {
    if (!channelRef.current || !roomId || !user || !room) return
    sound.playClick()

    const updatedRoom: RoomState = {
      ...room,
      players: room.players.map((p) =>
        p.id === playerIdRef.current ? { ...p, ready: true } : p
      ),
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
    if (!channelRef.current || !roomId || !room) return
    // Only the host (players[0]) may start — prevents both players generating
    // different question sets when both click around the same time
    if (room.players[0]?.id !== playerIdRef.current) return
    if (room.players.length < 2 || words.length < 10) return

    // From here on the lobby channel is being handed over to the game channel,
    // so a presence leave is not an opponent dropping out
    gameStartingRef.current = true
    stopJoinAttempt()

    // Extend the reservation for the duration of the match
    fetch("/api/rooms/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomId }),
    }).catch(() => {})

    const questions = generateQuestions(words, 10)

    await channelRef.current.send({
      type: "broadcast",
      event: "game-started",
      payload: { questions, totalQuestions: questions.length, wordLevel: selectedLevel },
    })

    sound.playGameStart()
    const opponent = room.players.find((p) => p.id !== playerIdRef.current)
    const opponentParams = opponent
      ? `&opponent=${encodeURIComponent(opponent.username)}&opponentId=${encodeURIComponent(opponent.id)}`
      : ""
    initGame("realtime", selectedLevel, words, questions.length, questions)
    router.push(`/game?roomId=${roomId}&isHost=true${opponentParams}`)
  }, [roomId, room, words, initGame, router, selectedLevel, stopJoinAttempt])

  const handleLeaveRoom = useCallback(() => {
    const channel = channelRef.current
    const supabase = getSupabase()
    // Tell the other player before tearing down so they don't wait forever
    if (channel && roomRef.current) {
      const remainingRoom = dropPlayerFromRoom(roomRef.current, playerIdRef.current)
      channel.send({
        type: "broadcast",
        event: "player-left",
        payload: { room: remainingRoom, username: user?.username, playerId: playerIdRef.current },
      })
    }
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current)
      joinTimeoutRef.current = null
    }
    stopJoinAttempt()
    presenceGraceTimersRef.current.forEach(clearTimeout)
    presenceGraceTimersRef.current = []
    gameStartingRef.current = false
    roomLevelRef.current = null
    setRoomLevel(null)
    if (roomId) releaseRoomReservation(roomId)
    if (channel && supabase) {
      supabase.removeChannel(channel)
    }
    channelRef.current = null
    setRoom(null)
    setRoomId("")
    setStatus("idle")
  }, [user, stopJoinAttempt, roomId, releaseRoomReservation])

  // Best-effort "I am leaving" signal for tab close / reload / back, so the other
  // player is not left waiting on a room that no longer exists. Presence covers
  // the cases where this message never makes it out.
  useEffect(() => {
    const onPageHide = () => {
      const channel = channelRef.current
      const currentRoom = roomRef.current
      if (!channel || !currentRoom) return
      channel.send({
        type: "broadcast",
        event: "player-left",
        payload: {
          room: dropPlayerFromRoom(currentRoom, playerIdRef.current),
          username: user?.username,
          playerId: playerIdRef.current,
        },
      })
      // sendBeacon survives the page teardown (a normal fetch may not), so the
      // seat is not left occupied until the TTL expires
      try {
        navigator.sendBeacon?.(
          "/api/rooms/leave",
          new Blob([JSON.stringify({ code: currentRoom.id })], { type: "application/json" })
        )
      } catch {
        // best effort only
      }
    }

    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [user])

  const isCurrentUserReady = room?.players.find((p) => p.id === playerId)?.ready ?? false
  // Host is always the room creator (players[0]); if they leave, the remaining
  // player becomes players[0] and inherits the host role
  const isHost = room?.players[0]?.id === playerId
  const allPlayersReady = room?.players.length === 2 && room.players.every((p) => p.ready)

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
                <span className="text-xs text-muted font-normal">词库：{roomLevel ?? selectedLevel}</span>
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
                            {player.id === room.players[0]?.id && <span className="mr-1">👑</span>}
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

              {allPlayersReady && isHost && (
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 bg-success hover:bg-success/90 animate-cta-glow shadow-md"
                  onClick={handleStartGame}
                  disabled={words.length < 10}
                >
                  {words.length < 10 ? "⏳ 词库加载中..." : "🚀 双方已就绪 · 开战！"}
                </Button>
              )}

              {allPlayersReady && !isHost && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  disabled
                >
                  ⏳ 已就绪，等待房主开战...
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                className="sm:w-32"
                onClick={handleLeaveRoom}
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

export default function LobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LobbyContent />
    </Suspense>
  )
}
