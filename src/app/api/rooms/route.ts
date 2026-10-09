import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"
import { generateRoomCode, isRoomLevel, roomExpiry, toPublicRoom } from "@/lib/rooms"
import { z } from "zod"

const createSchema = z.object({
  level: z.string().optional(),
})

// A 6-char code from a 31-glyph alphabet has plenty of room; retrying a few times
// makes an unlucky collision a non-event.
const MAX_CODE_ATTEMPTS = 5

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
}

/**
 * Create a lobby room. The code is owned by the database (unique index) instead
 * of being a client-side `Math.random()` that two hosts could collide on.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("请先登录", 401)
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError("请求参数不合法", 400)
    }
    const level = isRoomLevel(parsed.data.level) ? parsed.data.level : "CET4"

    // Recycle abandoned rooms so the code namespace and the table stay small
    await prisma.room.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    // A host only needs one live room
    await prisma.room.deleteMany({ where: { hostId: session.userId } })

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        const room = await prisma.room.create({
          data: {
            code: generateRoomCode(),
            level,
            hostId: session.userId,
            expiresAt: roomExpiry(),
          },
        })
        return apiSuccess({ room: toPublicRoom(room) })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
      }
    }

    return apiError("房间创建失败，请稍后重试", 503)
  } catch (error) {
    console.error("Create room error:", error)
    return apiError("房间创建失败")
  }
}
