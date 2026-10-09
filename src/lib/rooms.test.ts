import { describe, it, expect } from "vitest"
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_TTL_MS,
  generateRoomCode,
  isRoomExpired,
  isRoomLevel,
  isValidRoomCode,
  normalizeRoomCode,
  roomExpiry,
  toPublicRoom,
} from "./rooms"

describe("generateRoomCode", () => {
  it("produces codes of the expected length from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect([...code].every((char) => ROOM_CODE_ALPHABET.includes(char))).toBe(true)
    }
  })

  it("never emits easily confused glyphs", () => {
    const codes = Array.from({ length: 200 }, () => generateRoomCode()).join("")
    for (const bad of ["O", "0", "I", "1", "L"]) {
      expect(codes.includes(bad)).toBe(false)
    }
  })

  it("is injectable for deterministic tests", () => {
    expect(generateRoomCode(() => 0)).toBe(ROOM_CODE_ALPHABET[0].repeat(ROOM_CODE_LENGTH))
  })
})

describe("normalizeRoomCode / isValidRoomCode", () => {
  it("uppercases, trims and strips separators from user input", () => {
    expect(normalizeRoomCode("  ab-12 cd ")).toBe("AB12CD")
  })

  it("accepts valid codes in any case", () => {
    // Note: 0/1/O/I/L are intentionally absent from the alphabet
    expect(isValidRoomCode("ab23cd")).toBe(true)
    expect(isValidRoomCode("AB23CD")).toBe(true)
  })

  it("rejects wrong length or ambiguous characters", () => {
    expect(isValidRoomCode("ABC")).toBe(false)
    expect(isValidRoomCode("ABCDEFG")).toBe(false)
    expect(isValidRoomCode("ABC0EF")).toBe(false) // 0 is not in the alphabet
    expect(isValidRoomCode("ABC1EF")).toBe(false) // 1 is not in the alphabet
    expect(isValidRoomCode("ABCIEF")).toBe(false) // I is not in the alphabet
    expect(isValidRoomCode("")).toBe(false)
  })
})

describe("room expiry", () => {
  it("expires after the TTL", () => {
    const now = Date.now()
    expect(roomExpiry(now).getTime()).toBe(now + ROOM_TTL_MS)
    expect(isRoomExpired({ expiresAt: new Date(now - 1) }, now)).toBe(true)
    expect(isRoomExpired({ expiresAt: new Date(now + 1) }, now)).toBe(false)
    expect(isRoomExpired({ expiresAt: new Date(now) }, now)).toBe(true)
  })
})

describe("isRoomLevel", () => {
  it("only accepts supported word levels", () => {
    expect(isRoomLevel("IELTS")).toBe(true)
    expect(isRoomLevel("HACK")).toBe(false)
    expect(isRoomLevel(undefined)).toBe(false)
    expect(isRoomLevel(3)).toBe(false)
  })
})

describe("toPublicRoom", () => {
  it("exposes the code and occupancy without leaking player ids", () => {
    const publicRoom = toPublicRoom({
      id: "room-1",
      code: "AB12CD",
      status: "waiting",
      level: "CET6",
      hostId: "host-secret",
      guestId: null,
      expiresAt: new Date(),
    })
    expect(publicRoom).toEqual({
      id: "room-1",
      code: "AB12CD",
      level: "CET6",
      status: "waiting",
      filled: false,
    })
    expect(JSON.stringify(publicRoom)).not.toContain("host-secret")
  })

  it("reports a claimed seat", () => {
    const publicRoom = toPublicRoom({
      id: "room-1",
      code: "AB12CD",
      status: "waiting",
      level: "CET4",
      hostId: "host",
      guestId: "guest",
      expiresAt: new Date(),
    })
    expect(publicRoom.filled).toBe(true)
  })
})
