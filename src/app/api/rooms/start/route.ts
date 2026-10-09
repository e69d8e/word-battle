import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"
import { normalizeRoomCode, roomExpiry } from "@/lib/rooms"
import { z } from "zod"

const startSchema = z.object({
  code: z.string().min(1).max(12),
})

/**
 * Mark a room as in progress. Called (fire-and-forget) by the host when the
 * match starts: it extends the reservation so the code is not recycled while the
 * match is still running, and records that the room is no longer joinable.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const parsed = startSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError("请求参数不合法", 400)
    }

    const code = normalizeRoomCode(parsed.data.code)
    const updated = await prisma.room.updateMany({
      where: { code, hostId: session.userId },
      data: { status: "playing", expiresAt: roomExpiry() },
    })

    return apiSuccess({ started: updated.count > 0 })
  } catch (error) {
    console.error("Start room error:", error)
    return apiError("更新房间状态失败")
  }
}
