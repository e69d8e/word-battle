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

    if (username.length < 2 || username.length > 20) {
      return apiError("用户名长度应为2-20个字符", 400)
    }

    if (password.length < 6) {
      return apiError("密码长度不能少于6个字符", 400)
    }

    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) {
      return apiError("用户名已存在", 409)
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    })

    return apiSuccess({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Register error:", error)
    return apiError("注册失败，请稍后重试")
  }
}
