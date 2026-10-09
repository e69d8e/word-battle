import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"
import { normalizeRoomCode } from "@/lib/rooms"
import { z } from "zod"

const leaveSchema = z.object({
  code: z.string().min(1).max(12),
})

/**
 * Release a room reservation.
 *
 * Called from the "leave" button and from `navigator.sendBeacon` on pagehide, so
 * it has to be a POST that tolerates junk: it is idempotent and never fails for
 * an already-gone room.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const parsed = leaveSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError("请求参数不合法", 400)
    }

    const code = normalizeRoomCode(parsed.data.code)
    const room = await prisma.room.findUnique({ where: { code } })
    if (!room) {
      return apiSuccess({ released: false })
    }

    if (room.hostId === session.userId) {
      // The host closing the room ends it for the guest as well
      await prisma.room.deleteMany({ where: { id: room.id, hostId: session.userId } })
      return apiSuccess({ released: true, closed: true })
    }

    // Guest (or a stale guest entry): free the seat but keep the room open
    await prisma.room.updateMany({
      where: { id: room.id, guestId: session.userId },
      data: { guestId: null },
    })
    return apiSuccess({ released: true, closed: false })
  } catch (error) {
    console.error("Leave room error:", error)
    return apiError("离开房间失败")
  }
}
