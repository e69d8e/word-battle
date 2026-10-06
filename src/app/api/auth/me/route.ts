import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { getSessionFromRequest } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    // Identity comes from the session cookie — never from a query param
    const session = await getSessionFromRequest(req)
    if (!session) {
      return apiError("未登录", 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, avatar: true, createdAt: true },
    })

    if (!user) {
      return apiError("用户不存在", 404)
    }

    return apiSuccess({ user })
  } catch (error) {
    console.error("Get user error:", error)
    return apiError("获取用户信息失败")
  }
}
