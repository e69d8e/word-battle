"use client"

import { useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Word Battle</span>
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link href="/game">
                <Button variant="ghost" size="sm">开始PK</Button>
              </Link>
              <Link href="/lobby">
                <Button variant="ghost" size="sm">实时对战</Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant="ghost" size="sm">排行榜</Button>
              </Link>
              <Link href="/history">
                <Button variant="ghost" size="sm">历史记录</Button>
              </Link>
              <div className="flex items-center gap-3 ml-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">{user.username}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  退出
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">登录</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">注册</Button>
              </Link>
            </>
          )}
        </nav>

        {/* 移动端汉堡按钮 */}
        <button
          className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          <span className={`block w-5 h-0.5 bg-gray-700 transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* 移动端菜单 */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-2">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">{user.username}</span>
              </div>
              <Link href="/game" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">开始PK</Button>
              </Link>
              <Link href="/lobby" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">实时对战</Button>
              </Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">排行榜</Button>
              </Link>
              <Link href="/history" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">历史记录</Button>
              </Link>
              <Button variant="ghost" size="sm" className="w-full justify-start text-red-500" onClick={() => { logout(); setMenuOpen(false) }}>
                退出登录
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">登录</Button>
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">注册</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
