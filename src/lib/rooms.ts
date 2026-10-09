import type { WordLevel } from "@/types"
import { WORD_LEVELS } from "@/lib/realtime-protocol"

/**
 * Server-side lobby rooms.
 *
 * The realtime channel alone was not enough: two hosts could generate the same
 * 6-character code from `Math.random()` (nobody owned the namespace), and any
 * client could claim a seat by broadcasting the right events. Codes are now
 * handed out by the database and the second seat is claimed through the API
 * before the realtime handshake runs.
 */
export const ROOM_CODE_LENGTH = 6

/**
 * Ambiguous glyphs (O/0, I/1, L) are excluded so a code can be read aloud or
 * typed from a screenshot without guessing.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** Rooms are recycled after this long; a match needs ~3 minutes plus setup. */
export const ROOM_TTL_MS = 30 * 60 * 1000

export function generateRoomCode(random: () => number = Math.random): string {
  let code = ""
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** Accept lowercase/padded input from users and links. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function isValidRoomCode(input: string): boolean {
  const code = normalizeRoomCode(input)
  if (code.length !== ROOM_CODE_LENGTH) return false
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char))
}

export function roomExpiry(from: number = Date.now()): Date {
  return new Date(from + ROOM_TTL_MS)
}

export function isRoomLevel(level: unknown): level is WordLevel {
  return typeof level === "string" && (WORD_LEVELS as readonly string[]).includes(level)
}

export interface RoomRecord {
  id: string
  code: string
  status: string
  level: string
  hostId: string
  guestId: string | null
  expiresAt: Date
}

export function isRoomExpired(room: Pick<RoomRecord, "expiresAt">, now: number = Date.now()): boolean {
  return room.expiresAt.getTime() <= now
}

/** Public shape sent to clients — never leak the host/guest user ids. */
export function toPublicRoom(room: RoomRecord) {
  return {
    id: room.id,
    code: room.code,
    level: room.level,
    status: room.status,
    filled: room.guestId !== null,
  }
}
