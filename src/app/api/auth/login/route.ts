import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return apiError("用户名和密码不能为空", 400)
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return apiError("用户不存在，请先注册", 401)
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return apiError("密码错误，请重新输入", 401)
    }

    return apiSuccess({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return apiError("登录失败，请稍后重试")
  }
}
