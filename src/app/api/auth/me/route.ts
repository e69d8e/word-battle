import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("id")

    if (!userId) {
      return apiError("缺少用户ID", 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
