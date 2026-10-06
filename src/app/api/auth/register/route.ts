import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Username: 2-20 chars of CJK, letters, digits or underscore (trimmed).
// Password: 6-72 BYTES — bcrypt silently truncates beyond 72 bytes, so two
// distinct long passphrases could otherwise hash identically.
const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[\p{L}\p{N}_]+$/u, "用户名只能包含中文、字母、数字和下划线"),
  password: z
    .string()
    .min(6, "密码长度不能少于6个字符")
    .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "密码过长（最多72字节）"),
})

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`register:${getClientIp(req)}`, 10, 60_000)) {
      return apiError("注册过于频繁，请一分钟后再试", 429)
    }

    const parsed = registerSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "输入不合法", 400)
    }
    const { username, password } = parsed.data

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user
      .create({
        data: { username, password: hashedPassword },
      })
      .catch((err: unknown) => {
        // Concurrent registration with the same username → unique violation
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          return null
        }
        throw err
      })

    if (!user) {
      return apiError("用户名已存在", 409)
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
    console.error("Register error:", error)
    return apiError("注册失败，请稍后重试")
  }
}
