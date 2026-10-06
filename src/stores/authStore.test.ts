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
    // Identity comes from the httpOnly session cookie — no localStorage id
    expect(localStorage.getItem("userId")).toBeNull()
  })

  it("handles failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "用户名或密码错误" }),
      })
    )

    const result = await useAuthStore.getState().login("testuser", "wrongpass")

    expect(result.success).toBe(false)
    expect(result.error).toBe("用户名或密码错误")
    expect(useAuthStore.getState().user).toBeNull()
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
    expect(localStorage.getItem("userId")).toBeNull()
  })

  it("clears user and server session on logout", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    useAuthStore.setState({
      user: { id: "u-123", username: "testuser", createdAt: new Date() },
    })
    localStorage.setItem("userId", "u-123")

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem("userId")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" })
  })

  it("checkAuth restores user when session cookie is valid", async () => {
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

  it("checkAuth cleans up when session is missing (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "未登录" }),
      })
    )

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(localStorage.getItem("userId")).toBeNull()
  })

  it("checkAuth clears stale session when user no longer exists (404)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "用户不存在" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" })
  })
})
