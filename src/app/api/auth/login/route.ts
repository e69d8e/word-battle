import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import bcrypt from "bcryptjs"
import { z } from "zod"

const loginSchema = z.object({
  username: z.string().min(1).max(20),
  password: z.string().min(1).max(200),
})

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`login:${getClientIp(req)}`, 10, 60_000)) {
      return apiError("尝试过于频繁，请一分钟后再试", 429)
    }

    const parsed = loginSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError("用户名和密码不能为空", 400)
    }
    const { username, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { username } })

    // Single message for both unknown user and wrong password to prevent
    // account enumeration
    const isValidPassword = user ? await bcrypt.compare(password, user.password) : false
    if (!user || !isValidPassword) {
      return apiError("用户名或密码错误", 401)
    }

    const res = apiSuccess({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    })
    await setSessionCookie(res, { userId: user.id, username: user.username })
    return res
  } catch (error) {
    console.error("Login error:", error)
    return apiError("登录失败，请稍后重试")
  }
}
