"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/stores/authStore"
import { AuthForm } from "@/components/auth/AuthForm"

export default function RegisterPage() {
  const { register } = useAuthStore()
  const router = useRouter()

  return (
    <AuthForm
      icon={<span className="text-on-primary text-2xl">🎮</span>}
      title="创建账号"
      description="加入 Word Battle，开始你的单词PK之旅"
      fields={[
        { id: "username", label: "用户名", type: "text", placeholder: "请输入用户名（2-20个字符）" },
        { id: "password", label: "密码", type: "password", placeholder: "请输入密码（至少6个字符）" },
        { id: "confirmPassword", label: "确认密码", type: "password", placeholder: "请再次输入密码" },
      ]}
      submitLabel="注册"
      loadingLabel="注册中..."
      extraValidation={({ username, password, confirmPassword }) => {
        if (password !== confirmPassword) return "两次输入的密码不一致"
        if (password.length < 6) return "密码长度不能少于6个字符"
        if (username.length < 2 || username.length > 20) return "用户名长度应为2-20个字符"
        return null
      }}
      onSubmit={async ({ username, password }) => {
        const success = await register(username, password)
        if (success) {
          router.push("/game")
          return true
        }
        return "注册失败，用户名可能已存在"
      }}
      footer={
        <p className="text-sm text-center text-muted">
          已有账号？{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            立即登录
          </Link>
        </p>
      }
    />
  )
}
