import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"
import { isRoomExpired, isValidRoomCode, normalizeRoomCode, roomExpiry, toPublicRoom } from "@/lib/rooms"
import { z } from "zod"

const joinSchema = z.object({
  code: z.string().min(1).max(12),
})

/**
 * Claim the second seat of a room before the realtime handshake starts, so a
 * full/expired/unknown room is rejected by the server instead of by racing
 * broadcasts.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const parsed = joinSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError("请填写房间号", 400)
    }

    const code = normalizeRoomCode(parsed.data.code)
    if (!isValidRoomCode(code)) {
      return apiError("房间号格式不正确", 400)
    }

    const room = await prisma.room.findUnique({ where: { code } })
    if (!room || isRoomExpired(room)) {
      if (room) {
        await prisma.room.deleteMany({ where: { id: room.id } }).catch(() => {})
      }
      return apiError("房间不存在或已过期，请让好友重新创建", 404)
    }

    if (room.hostId === session.userId) {
      return apiError("这是你自己创建的房间，请把房间号发给好友", 409)
    }

    if (room.guestId && room.guestId !== session.userId) {
      return apiError("房间已满（2 人）", 409)
    }

    // Conditional update: two guests racing for the last seat cannot both win
    const claim = await prisma.room.updateMany({
      where: { id: room.id, OR: [{ guestId: null }, { guestId: session.userId }] },
      data: { guestId: session.userId, expiresAt: roomExpiry() },
    })
    if (claim.count === 0) {
      return apiError("房间已满（2 人）", 409)
    }

    return apiSuccess({
      room: toPublicRoom({ ...room, guestId: session.userId }),
    })
  } catch (error) {
    console.error("Join room error:", error)
    return apiError("加入房间失败")
  }
}
