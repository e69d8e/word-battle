import { create } from "zustand"
import type { User } from "@/types"

export interface AuthResult {
  success: boolean
  error?: string
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<AuthResult>
  register: (username: string, password: string) => Promise<AuthResult>
  logout: () => void
  checkAuth: () => Promise<void>
}

async function authRequest(url: string, body: object): Promise<{ user: User | null; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { user: null, error: data.error || "请求失败，请稍后重试" }
    }
    return { user: data.user }
  } catch {
    return { user: null, error: "网络连接异常，请检查网络或稍后重试" }
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  login: async (username, password) => {
    try {
      const cleanUsername = username.trim()
      const { user, error } = await authRequest("/api/auth/login", { username: cleanUsername, password })
      if (user) {
        set({ user })
        localStorage.setItem("userId", user.id)
        return { success: true }
      }
      return { success: false, error: error || "用户名或密码错误" }
    } catch {
      return { success: false, error: "登录失败，请稍后重试" }
    }
  },

  register: async (username, password) => {
    try {
      const cleanUsername = username.trim()
      const { user, error } = await authRequest("/api/auth/register", { username: cleanUsername, password })
      if (user) {
        set({ user })
        localStorage.setItem("userId", user.id)
        return { success: true }
      }
      return { success: false, error: error || "注册失败，请稍后重试" }
    } catch {
      return { success: false, error: "注册失败，请稍后重试" }
    }
  },

  logout: () => {
    set({ user: null })
    localStorage.removeItem("userId")
  },

  checkAuth: async () => {
    if (typeof window === "undefined") {
      set({ isLoading: false })
      return
    }
    const userId = localStorage.getItem("userId")
    if (!userId) {
      set({ isLoading: false })
      return
    }
    try {
      const res = await fetch(`/api/auth/me?id=${userId}`)
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, isLoading: false })
      } else if (res.status === 404) {
        // User strictly deleted or doesn't exist
        localStorage.removeItem("userId")
        set({ user: null, isLoading: false })
      } else {
        // Database timeout or 500 error - don't remove userId, allow retry
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
