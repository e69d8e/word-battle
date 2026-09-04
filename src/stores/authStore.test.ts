import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useAuthStore } from "./authStore"

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, isLoading: true })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("handles successful login", async () => {
    const mockUser = {
      id: "u-123",
      username: "testuser",
      createdAt: new Date(),
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser }),
      })
    )

    const result = await useAuthStore.getState().login("testuser", "password123")

    expect(result.success).toBe(true)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(localStorage.getItem("userId")).toBe("u-123")
  })

  it("handles failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "密码错误，请重新输入" }),
      })
    )

    const result = await useAuthStore.getState().login("testuser", "wrongpass")

    expect(result.success).toBe(false)
    expect(result.error).toBe("密码错误，请重新输入")
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem("userId")).toBeNull()
  })

  it("handles registration successfully", async () => {
    const mockUser = {
      id: "u-456",
      username: "newuser",
      createdAt: new Date(),
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser }),
      })
    )

    const result = await useAuthStore.getState().register("newuser", "securepass")

    expect(result.success).toBe(true)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(localStorage.getItem("userId")).toBe("u-456")
  })

  it("clears user and storage on logout", () => {
    useAuthStore.setState({
      user: { id: "u-123", username: "testuser", createdAt: new Date() },
    })
    localStorage.setItem("userId", "u-123")

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem("userId")).toBeNull()
  })

  it("checkAuth restores user when valid userId in localStorage", async () => {
    localStorage.setItem("userId", "u-123")
    const mockUser = {
      id: "u-123",
      username: "testuser",
      createdAt: new Date(),
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      })
    )

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it("checkAuth cleans up when user is not found (404)", async () => {
    localStorage.setItem("userId", "deleted-user")

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "用户不存在" }),
      })
    )

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(localStorage.getItem("userId")).toBeNull()
  })
})
