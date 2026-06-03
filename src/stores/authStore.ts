import { create } from "zustand"
import type { User } from "@/types"

interface AuthStore {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  login: async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user })
        localStorage.setItem("userId", data.user.id)
        return true
      }
      return false
    } catch {
      return false
    }
  },

  register: async (username, password) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user })
        localStorage.setItem("userId", data.user.id)
        return true
      }
      return false
    } catch {
      return false
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
      } else {
        localStorage.removeItem("userId")
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
