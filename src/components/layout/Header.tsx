"use client"

import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
  const { user, logout } = useAuthStore()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Word Battle</span>
        </Link>

        <nav className="flex items-center gap-4">
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
      </div>
    </header>
  )
}
