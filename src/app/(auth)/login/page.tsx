"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/stores/authStore"
import { AuthForm } from "@/components/auth/AuthForm"

export default function LoginPage() {
  const { login } = useAuthStore()
  const router = useRouter()

  return (
    <AuthForm
      icon={<span className="text-on-primary text-2xl">⚔️</span>}
      title="欢迎回来"
      description="登录你的 Word Battle 账号"
      fields={[
        { id: "username", label: "用户名", type: "text", placeholder: "请输入用户名" },
        { id: "password", label: "密码", type: "password", placeholder: "请输入密码" },
      ]}
      submitLabel="登录"
      loadingLabel="登录中..."
      onSubmit={async ({ username, password }) => {
        const success = await login(username, password)
        if (success) {
          router.push("/game")
          return true
        }
        return "用户名或密码错误"
      }}
      footer={
        <p className="text-sm text-center text-muted">
          还没有账号？{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            立即注册
          </Link>
        </p>
      }
    />
  )
}
