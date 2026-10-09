import type { WordLevel } from "@/types"

/**
 * Realtime wire protocol for multiplayer rooms.
 *
 * Two topics per room:
 * - lobby: `room:{roomId}`     — create/join/ready handshake
 * - match: `room:{roomId}:play` — answers, results, rematch
 *
 * They are deliberately separate: the lobby channel is torn down when a player
 * navigates into the match, and sharing one topic made that teardown look like
 * the opponent disconnecting (presence `leave`) at the start of every game.
 */
export const ROOM_TOPIC = (roomId: string) => `room:${roomId}`
export const PLAY_TOPIC = (roomId: string) => `room:${roomId}:play`

export const MAX_ROOM_PLAYERS = 2

export const WORD_LEVELS: readonly WordLevel[] = ["CET4", "CET6", "TOEFL", "IELTS"]

export interface RoomPlayer {
  id: string
  username: string
  ready: boolean
}

export interface RoomLike {
  id: string
  players: RoomPlayer[]
  status?: string
}

export type JoinRequestDecision<R extends RoomLike = RoomLike> =
  | { action: "ignore" }
  | { action: "full"; room: R }
  | { action: "reply"; room: R }

/**
 * Decide how a client should answer a `request-state` broadcast.
 *
 * Only the host (`players[0]`) may answer. When every member replied, every
 * member also evaluated the capacity check — so a third player would make all
 * existing members broadcast `room-full` and kick themselves out.
 *
 * Generic over the room type so callers keep their richer room shape.
 */
export function decideJoinRequest<R extends RoomLike>(args: {
  room: R | null
  myPlayerId: string
  requesterId: string
  requesterName: string
  maxPlayers?: number
}): JoinRequestDecision<R> {
  const { room, myPlayerId, requesterId, requesterName, maxPlayers = MAX_ROOM_PLAYERS } = args
  if (!room) return { action: "ignore" }
  if (room.players[0]?.id !== myPlayerId) return { action: "ignore" }

  const alreadyIn = room.players.some((p) => p.id === requesterId)
  if (alreadyIn) return { action: "reply", room }
  if (room.players.length >= maxPlayers) return { action: "full", room }

  return {
    action: "reply",
    room: {
      ...room,
      players: [...room.players, { id: requesterId, username: requesterName, ready: false }],
    } as R,
  }
}

/**
 * Should this client act on a `room-full` broadcast?
 *
 * Channels are created with `broadcast: { self: true }`, so the sender receives
 * its own rejection — without the sender check the host would kick itself out of
 * its own room, and so would the opponent sitting in it. `awaitingRoomState` is
 * only true for a client that is actually in the middle of joining.
 */
export function shouldHandleRoomFull(args: {
  payloadSenderId?: string | null
  myPlayerId: string
  awaitingRoomState: boolean
}): boolean {
  const { payloadSenderId, myPlayerId, awaitingRoomState } = args
  if (payloadSenderId === myPlayerId) return false
  return awaitingRoomState
}

/** Remove a player (e.g. after a presence `leave`). Returns null when unchanged. */
export function dropPlayerFromRoom<R extends RoomLike>(room: R | null, playerId: string): R | null {
  if (!room) return null
  if (!room.players.some((p) => p.id === playerId)) return null
  return { ...room, players: room.players.filter((p) => p.id !== playerId) } as R
}

/**
 * Merge an incoming room snapshot into the one we already know.
 *
 * Every client broadcasts its own full snapshot, and `ready` only ever goes
 * false -> true in this UI (there is no "unready"). Without merging, a snapshot
 * built before the peer clicked 准备 overwrites it, so two players pressing
 * 准备 at almost the same moment bounce each other back to "准备中" and the host
 * can never start. Ready flags are therefore sticky per player.
 */
export function mergeReadyFlags<R extends RoomLike>(previous: R | null, incoming: R | null): R | null {
  if (!incoming || !previous) return incoming
  return {
    ...incoming,
    players: incoming.players.map((player) => {
      const known = previous.players.find((p) => p.id === player.id)
      return known?.ready ? { ...player, ready: true } : player
    }),
  }
}

/**
 * The match level is chosen by the host. A joining client must adopt the level
 * from the `game-started` payload instead of its own selection, otherwise the
 * same match is saved with two different levels.
 */
export function resolveGameLevel(payloadLevel: unknown, fallback: WordLevel): WordLevel {
  return typeof payloadLevel === "string" && (WORD_LEVELS as readonly string[]).includes(payloadLevel)
    ? (payloadLevel as WordLevel)
    : fallback
}

/**
 * Normalize the `player-left` payload. Clients send either a full room snapshot
 * or just the leaver's id (the join-timeout path and `pagehide` send the latter).
 */
export function parsePlayerLeftPayload<R extends RoomLike>(
  payload: { room?: R | null; playerId?: string | null; username?: string | null } | null | undefined,
  currentRoom: R | null
): { room: R | null; playerId: string | null; username: string | null } {
  const username = typeof payload?.username === "string" ? payload.username : null
  const playerId = typeof payload?.playerId === "string" ? payload.playerId : null

  if (payload?.room) {
    return { room: payload.room, playerId, username }
  }
  if (playerId) {
    return { room: dropPlayerFromRoom(currentRoom, playerId), playerId, username }
  }
  return { room: null, playerId, username }
}
