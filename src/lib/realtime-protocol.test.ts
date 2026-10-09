import { describe, it, expect } from "vitest"
import {
  PLAY_TOPIC,
  ROOM_TOPIC,
  decideJoinRequest,
  dropPlayerFromRoom,
  mergeReadyFlags,
  parsePlayerLeftPayload,
  resolveGameLevel,
  shouldHandleRoomFull,
  type RoomLike,
} from "@/lib/realtime-protocol"

const HOST = "host-id"
const GUEST = "guest-id"
const THIRD = "third-id"

const emptyRoom: RoomLike = { id: "ABC123", players: [], status: "waiting" }
const hostRoom: RoomLike = {
  id: "ABC123",
  players: [{ id: HOST, username: "Host", ready: true }],
  status: "waiting",
}
const fullRoom: RoomLike = {
  id: "ABC123",
  players: [
    { id: HOST, username: "Host", ready: true },
    { id: GUEST, username: "Guest", ready: false },
  ],
  status: "waiting",
}

describe("room topics", () => {
  // The smoke script in scripts/ hardcodes these two patterns; keep them in sync
  it("keeps the lobby and match topics separate", () => {
    expect(ROOM_TOPIC("ABC123")).toBe("room:ABC123")
    expect(PLAY_TOPIC("ABC123")).toBe("room:ABC123:play")
    expect(ROOM_TOPIC("ABC123")).not.toBe(PLAY_TOPIC("ABC123"))
  })
})

describe("decideJoinRequest", () => {
  it("ignores requests when there is no room yet", () => {
    expect(
      decideJoinRequest({ room: null, myPlayerId: HOST, requesterId: GUEST, requesterName: "G" })
    ).toEqual({ action: "ignore" })
  })

  it("ignores requests on a non-host client so only one member answers", () => {
    expect(
      decideJoinRequest({ room: fullRoom, myPlayerId: GUEST, requesterId: THIRD, requesterName: "T" })
    ).toEqual({ action: "ignore" })
  })

  it("adds the requester when the host has a free slot", () => {
    const decision = decideJoinRequest({
      room: hostRoom,
      myPlayerId: HOST,
      requesterId: GUEST,
      requesterName: "Guest",
    })
    expect(decision.action).toBe("reply")
    if (decision.action !== "reply") throw new Error("unreachable")
    expect(decision.room.players.map((p) => p.id)).toEqual([HOST, GUEST])
    expect(decision.room.players[1]).toEqual({ id: GUEST, username: "Guest", ready: false })
    // The host keeps its slot (and its host role)
    expect(decision.room.players[0].id).toBe(HOST)
  })

  it("rejects a newcomer once the room is full", () => {
    const decision = decideJoinRequest({
      room: fullRoom,
      myPlayerId: HOST,
      requesterId: THIRD,
      requesterName: "T",
    })
    expect(decision.action).toBe("full")
    // The host must still be able to tell the joiner which room was full
    if (decision.action !== "full") throw new Error("unreachable")
    expect(decision.room.id).toBe("ABC123")
  })

  it("re-acknowledges a player that is already in the room (lost reply / refresh)", () => {
    const decision = decideJoinRequest({
      room: fullRoom,
      myPlayerId: HOST,
      requesterId: GUEST,
      requesterName: "Guest",
    })
    expect(decision.action).toBe("reply")
    if (decision.action !== "reply") throw new Error("unreachable")
    expect(decision.room.players).toHaveLength(2)
  })

  it("does not mutate the room it was given", () => {
    const snapshot = JSON.stringify(hostRoom)
    decideJoinRequest({ room: hostRoom, myPlayerId: HOST, requesterId: GUEST, requesterName: "G" })
    expect(JSON.stringify(hostRoom)).toBe(snapshot)
  })

  it("uses a custom capacity when provided", () => {
    const decision = decideJoinRequest({
      room: hostRoom,
      myPlayerId: HOST,
      requesterId: GUEST,
      requesterName: "G",
      maxPlayers: 1,
    })
    expect(decision.action).toBe("full")
  })

  it("ignores requests when nobody is in the room yet (no host to answer)", () => {
    expect(
      decideJoinRequest({ room: emptyRoom, myPlayerId: HOST, requesterId: GUEST, requesterName: "G" })
    ).toEqual({ action: "ignore" })
  })
})

describe("shouldHandleRoomFull", () => {
  it("ignores the echo of our own broadcast (self: true) — the host must not kick itself", () => {
    expect(
      shouldHandleRoomFull({ payloadSenderId: HOST, myPlayerId: HOST, awaitingRoomState: false })
    ).toBe(false)
    // Even a host that thinks it is joining must not act on its own rejection
    expect(
      shouldHandleRoomFull({ payloadSenderId: HOST, myPlayerId: HOST, awaitingRoomState: true })
    ).toBe(false)
  })

  it("ignores a rejection addressed to somebody else", () => {
    // A player already sitting in the room must not tear its own channel down
    expect(
      shouldHandleRoomFull({ payloadSenderId: HOST, myPlayerId: GUEST, awaitingRoomState: false })
    ).toBe(false)
  })

  it("acts only for the client that is currently joining", () => {
    expect(
      shouldHandleRoomFull({ payloadSenderId: HOST, myPlayerId: THIRD, awaitingRoomState: true })
    ).toBe(true)
  })

  it("ignores payloads with no sender (legacy/other client)", () => {
    expect(
      shouldHandleRoomFull({ payloadSenderId: undefined, myPlayerId: THIRD, awaitingRoomState: true })
    ).toBe(true)
    expect(
      shouldHandleRoomFull({ payloadSenderId: null, myPlayerId: THIRD, awaitingRoomState: false })
    ).toBe(false)
  })
})

describe("dropPlayerFromRoom", () => {
  it("removes the player and keeps the host slot", () => {
    const room = dropPlayerFromRoom(fullRoom, GUEST)
    expect(room?.players.map((p) => p.id)).toEqual([HOST])
  })

  it("promotes the remaining player to host when the host leaves", () => {
    const room = dropPlayerFromRoom(fullRoom, HOST)
    expect(room?.players[0].id).toBe(GUEST)
  })

  it("returns null when nothing changed", () => {
    expect(dropPlayerFromRoom(null, HOST)).toBeNull()
    expect(dropPlayerFromRoom(hostRoom, THIRD)).toBeNull()
  })
})

describe("mergeReadyFlags", () => {
  const bothReady: RoomLike = {
    id: "ABC123",
    players: [
      { id: HOST, username: "Host", ready: true },
      { id: GUEST, username: "Guest", ready: true },
    ],
  }

  it("does not let a stale snapshot clear a player's ready flag", () => {
    // The peer's snapshot was built before our ready click landed
    const stale: RoomLike = {
      id: "ABC123",
      players: [
        { id: HOST, username: "Host", ready: false },
        { id: GUEST, username: "Guest", ready: false },
      ],
    }
    const merged = mergeReadyFlags(bothReady, stale)
    expect(merged?.players.every((p) => p.ready)).toBe(true)
  })

  it("still accepts a newly ready player", () => {
    const hostReady: RoomLike = { id: "ABC123", players: [{ id: HOST, username: "Host", ready: true }] }
    const incoming: RoomLike = {
      id: "ABC123",
      players: [
        { id: HOST, username: "Host", ready: true },
        { id: GUEST, username: "Guest", ready: true },
      ],
    }
    const merged = mergeReadyFlags(hostReady, incoming)
    expect(merged?.players.find((p) => p.id === GUEST)?.ready).toBe(true)
  })

  it("keeps a genuinely not-ready player not ready", () => {
    const known: RoomLike = { id: "ABC123", players: [{ id: GUEST, username: "Guest", ready: false }] }
    const incoming: RoomLike = {
      id: "ABC123",
      players: [
        { id: HOST, username: "Host", ready: true },
        { id: GUEST, username: "Guest", ready: false },
      ],
    }
    const merged = mergeReadyFlags(known, incoming)
    expect(merged?.players.find((p) => p.id === GUEST)?.ready).toBe(false)
    expect(merged?.players.find((p) => p.id === HOST)?.ready).toBe(true)
  })

  it("takes a re-joining player's fresh (not ready) state", () => {
    // The player left, so they are gone from the local roster
    const known: RoomLike = { id: "ABC123", players: [{ id: HOST, username: "Host", ready: true }] }
    const incoming: RoomLike = {
      id: "ABC123",
      players: [
        { id: HOST, username: "Host", ready: false },
        { id: GUEST, username: "Guest", ready: false },
      ],
    }
    const merged = mergeReadyFlags(known, incoming)
    expect(merged?.players.find((p) => p.id === GUEST)?.ready).toBe(false)
  })

  it("passes through null/incoming-only safely", () => {
    expect(mergeReadyFlags(null, bothReady)).toBe(bothReady)
    expect(mergeReadyFlags(bothReady, null)).toBeNull()
  })

  it("does not mutate its inputs", () => {
    const before = JSON.stringify(bothReady)
    mergeReadyFlags(bothReady, { id: "ABC123", players: [{ id: HOST, username: "Host", ready: false }] })
    expect(JSON.stringify(bothReady)).toBe(before)
  })
})

describe("resolveGameLevel", () => {
  it("accepts a level sent by the host", () => {
    expect(resolveGameLevel("IELTS", "CET4")).toBe("IELTS")
  })

  it("falls back to the local selection for unknown/garbage payloads", () => {
    expect(resolveGameLevel(undefined, "CET6")).toBe("CET6")
    expect(resolveGameLevel("HACK", "CET6")).toBe("CET6")
    expect(resolveGameLevel(42, "CET6")).toBe("CET6")
    expect(resolveGameLevel(null, "CET6")).toBe("CET6")
  })
})

describe("parsePlayerLeftPayload", () => {
  it("uses the room snapshot when the leaver sent one", () => {
    const signal = parsePlayerLeftPayload(
      { room: { ...fullRoom, players: [fullRoom.players[0]] }, username: "Guest", playerId: GUEST },
      fullRoom
    )
    expect(signal.room?.players.map((p) => p.id)).toEqual([HOST])
    expect(signal.username).toBe("Guest")
  })

  it("falls back to removing the player id when no room snapshot was sent", () => {
    const signal = parsePlayerLeftPayload({ playerId: GUEST, username: "Guest" }, fullRoom)
    expect(signal.room?.players.map((p) => p.id)).toEqual([HOST])
  })

  it("returns a null room when it cannot identify who left", () => {
    expect(parsePlayerLeftPayload({}, fullRoom).room).toBeNull()
    expect(parsePlayerLeftPayload(null, fullRoom).room).toBeNull()
  })
})
