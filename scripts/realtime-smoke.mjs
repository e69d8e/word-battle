#!/usr/bin/env node
/**
 * Realtime smoke test — verifies the transport assumptions the multiplayer flow
 * depends on, against the project's real Supabase project.
 *
 * These are things a unit test cannot cover (server behaviour), so they are
 * checked here instead:
 *   - lobby broadcasts reach every member, in both directions
 *   - presence requires an opt-in and a `track()` to flow
 *   - presence `leave` fires for a departing member
 *   - the lobby → match hand-off does not look like an opponent leaving
 *   - match traffic flows on the dedicated play topic
 *   - `broadcast: { self: true }` echoes to the sender (why room-full needs a
 *     sender guard in src/lib/realtime-protocol.ts)
 *
 * Usage:
 *   npm run smoke:realtime            # reads NEXT_PUBLIC_SUPABASE_* from .env
 *
 * Exits non-zero when any check fails. Read-only: it only uses throwaway topics
 * and never touches the database.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"

const TIMEOUT_MS = 15_000
const SETTLE_MS = 1_500
/** Window for asserting that something does NOT happen */
const QUIET_MS = 3_000

// Must match ROOM_TOPIC / PLAY_TOPIC in src/lib/realtime-protocol.ts
// (src/lib/realtime-protocol.test.ts pins these strings).
const ROOM_TOPIC = (roomId) => `room:${roomId}`
const PLAY_TOPIC = (roomId) => `room:${roomId}:play`

function loadEnv() {
  const fromFile = {}
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue
      const index = line.indexOf("=")
      fromFile[line.slice(0, index).trim()] = line
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "")
    }
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || fromFile.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

const { url, key } = loadEnv()
if (!url || !key) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured (.env)")
  process.exit(1)
}

const results = []
function check(label, ok, detail = "") {
  results.push({ label, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const makeClient = () => createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } })

/** Poll until the condition holds (network events arrive asynchronously). */
async function waitFor(predicate, timeout = 8_000, interval = 200) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await sleep(interval)
  }
  return predicate()
}

async function waitSubscribed(channel, timeout = TIMEOUT_MS) {
  if (channel.state === "joined") return true
  // Kick off the subscription and then poll for the joined state. Polling (rather
  // than trusting the first callback) tolerates a transient CHANNEL_ERROR that
  // the client recovers from with an automatic rejoin.
  channel.subscribe()
  return waitFor(() => channel.state === "joined", timeout, 150)
}

/** Collects broadcast events for a given event name (register before subscribe). */
function collectBroadcasts(channel, event) {
  const seen = []
  channel.on("broadcast", { event }, (payload) => seen.push(payload))
  return seen
}

/** Collects presence leaves (must be registered before subscribe()). */
function collectLeaves(channel) {
  const leaves = []
  channel.on("presence", { event: "leave" }, ({ key: leftKey }) => leaves.push(leftKey))
  return leaves
}

const presenceKeys = (channel) => Object.keys(channel.presenceState())
const suffix = () => Math.random().toString(36).slice(2, 6).toUpperCase()

async function closeAll(clients) {
  for (const client of clients) {
    await client.removeAllChannels().catch(() => {})
  }
}

async function main() {
  console.log(`Realtime smoke test against ${new URL(url).host}\n`)

  // ------------------------------------------------------ broadcasts + presence
  {
    const clients = [makeClient(), makeClient()]
    const [host, guest] = clients
    const roomId = `SM${suffix()}`
    const hostChannel = host.channel(ROOM_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "host" }, broadcast: { self: true } },
    })
    const guestChannel = guest.channel(ROOM_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "guest" }, broadcast: { self: true } },
    })
    const toGuest = collectBroadcasts(guestChannel, "room-update")
    const toHost = collectBroadcasts(hostChannel, "request-state")
    const hostLeaves = collectLeaves(hostChannel)

    const hostJoined = await waitSubscribed(hostChannel)
    const guestJoined = await waitSubscribed(guestChannel)
    check(
      "both clients subscribe to the room topic",
      hostJoined && guestJoined,
      `host=${hostChannel.state} guest=${guestChannel.state}`
    )
    await hostChannel.track({ id: "host" })
    await guestChannel.track({ id: "guest" })

    const sawHost = await waitFor(() => guestChannel.presenceState().host?.length === 1)
    check("presence reaches the other member", sawHost, `guest sees=[${presenceKeys(guestChannel).join(",")}]`)
    const hostSeesGuest = await waitFor(() => hostChannel.presenceState().guest?.length === 1)
    check(
      "both members publish presence (host can see the guest)",
      hostSeesGuest,
      `host sees=[${presenceKeys(hostChannel).join(",")}]`
    )

    await hostChannel.send({ type: "broadcast", event: "room-update", payload: { room: { id: roomId } } })
    const gotRoomUpdate = await waitFor(() => toGuest.length >= 1)
    check("host → guest broadcast is delivered", gotRoomUpdate && toGuest.length === 1, `received=${toGuest.length}`)

    await guestChannel.send({
      type: "broadcast",
      event: "request-state",
      payload: { playerId: "guest", username: "Guest" },
    })
    const gotRequest = await waitFor(() => toHost.length >= 1)
    check("guest → host broadcast is delivered", gotRequest && toHost.length === 1, `received=${toHost.length}`)

    await guest.removeAllChannels()
    // Also drop the socket: this mirrors a closed tab and makes the server notice
    // the departure immediately instead of waiting for a heartbeat timeout
    guest.realtime.disconnect()
    const sawLeave = await waitFor(() => hostLeaves.includes("guest"), 12_000)
    check("presence `leave` is delivered when a member drops", sawLeave, `host saw=[${hostLeaves.join(",")}]`)

    await closeAll(clients)
  }

  // ------------------------------------------- presence requires an opt-in
  {
    const clients = [makeClient(), makeClient()]
    const [host, guest] = clients
    const topic = ROOM_TOPIC(`SM${suffix()}`)
    // The host opts in and publishes; the guest starts with neither
    const hostChannel = host.channel(topic, { config: { presence: { enabled: true, key: "host" } } })
    const guestChannel = guest.channel(topic, { config: { presence: { key: "guest" } } })
    await waitSubscribed(hostChannel)
    await waitSubscribed(guestChannel)
    await hostChannel.track({ id: "host" })
    await sleep(QUIET_MS)

    check(
      "presence stays empty for a channel that neither opts in nor tracks",
      presenceKeys(guestChannel).length === 0,
      `guest sees=[${presenceKeys(guestChannel).join(",")}]`
    )

    await guestChannel.track({ id: "guest" })
    const bothVisible = await waitFor(() => {
      const keys = presenceKeys(guestChannel)
      return keys.includes("host") && keys.includes("guest")
    })
    check("presence flows once both members track", bothVisible, `guest sees=[${presenceKeys(guestChannel).join(",")}]`)
    await closeAll(clients)
  }

  // -------------------------------------------------------- hand-off isolation
  {
    const clients = [makeClient(), makeClient()]
    const [host, guest] = clients
    const roomId = `SM${suffix()}`
    const hostLobby = host.channel(ROOM_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "host" }, broadcast: { self: true } },
    })
    const guestLobby = guest.channel(ROOM_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "guest" }, broadcast: { self: true } },
    })
    const guestLobbyLeaves = collectLeaves(guestLobby)
    await waitSubscribed(hostLobby)
    await waitSubscribed(guestLobby)
    await hostLobby.track({ id: "host" })
    await guestLobby.track({ id: "guest" })
    await waitFor(() => guestLobby.presenceState().host?.length === 1)

    const hostPlay = host.channel(PLAY_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "host" }, broadcast: { self: true } },
    })
    const guestPlay = guest.channel(PLAY_TOPIC(roomId), {
      config: { presence: { enabled: true, key: "guest" }, broadcast: { self: true } },
    })
    const guestPlayLeaves = collectLeaves(guestPlay)
    const guestPlayAnswers = collectBroadcasts(guestPlay, "answer-submitted")
    await waitSubscribed(hostPlay)
    await waitSubscribed(guestPlay)
    await hostPlay.track({ id: "host" })
    await guestPlay.track({ id: "guest" })
    await waitFor(() => guestPlay.presenceState().host?.length === 1)

    // The host navigates from the lobby into the match
    await host.removeChannel(hostLobby)
    await sleep(QUIET_MS)

    check(
      "lobby teardown does NOT look like the opponent leaving the match",
      guestPlayLeaves.length === 0,
      `play leaves=[${guestPlayLeaves.join(",")}]`
    )
    check("the lobby channel did observe the lobby leave", guestLobbyLeaves.includes("host"))

    await hostPlay.send({
      type: "broadcast",
      event: "answer-submitted",
      payload: { playerId: "host", questionId: "q-1", isCorrect: true },
    })
    const gotAnswer = await waitFor(() => guestPlayAnswers.length >= 1)
    check("match traffic arrives on the play topic", gotAnswer, `received=${guestPlayAnswers.length}`)

    await host.removeChannel(hostPlay)
    host.realtime.disconnect()
    const sawPlayLeave = await waitFor(() => guestPlayLeaves.includes("host"), 12_000)
    check("a real departure is detected on the play topic", sawPlayLeave, `play leaves=[${guestPlayLeaves.join(",")}]`)

    await closeAll(clients)
  }

  // ------------------------------------------------------------- self broadcast
  {
    const clients = [makeClient()]
    const [host] = clients
    const topic = ROOM_TOPIC(`SM${suffix()}`)
    const channel = host.channel(topic, {
      config: { presence: { enabled: true, key: "host" }, broadcast: { self: true } },
    })
    const echoes = collectBroadcasts(channel, "room-full")
    await waitSubscribed(channel)
    await channel.send({ type: "broadcast", event: "room-full", payload: { senderId: "host" } })

    const echoed = await waitFor(() => echoes.length >= 1)
    check(
      "`self: true` echoes the sender (room-full therefore needs a sender guard)",
      echoed && echoes.length === 1,
      `echoes=${echoes.length}`
    )
    await closeAll(clients)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) {
    console.log(`failed: ${failed.map((r) => r.label).join(" | ")}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("smoke test crashed:", error)
  process.exit(1)
})
