"use client"

import { useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { sound } from "@/lib/sound"
import Link from "next/link"

const subscribeSound = (callback: () => void) => {
  window.addEventListener("word_battle_sound_toggle", callback)
  return () => window.removeEventListener("word_battle_sound_toggle", callback)
}
const getSoundSnapshot = () => sound.isEnabled()
const getSoundServerSnapshot = () => true

export function Header() {
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const soundEnabled = useSyncExternalStore(subscribeSound, getSoundSnapshot, getSoundServerSnapshot)

  const toggleSound = () => {
    const nextState = sound.toggle()
    if (nextState) {
      sound.playClick()
    }
  }

  const navLinks = [
    { href: "/game", label: "开始PK", icon: "⚔️" },
    { href: "/lobby", label: "实时对战", icon: "⚡" },
    { href: "/leaderboard", label: "排行榜", icon: "🏆" },
    { href: "/history", label: "历史记录", icon: "📜" },
  ]

  return (
    <header className="bg-canvas/90 backdrop-blur-md border-b border-hairline sticky top-0 z-50 transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-on-primary font-bold text-sm">W</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-medium text-ink tracking-tight leading-none">Word Battle</span>
            <span className="text-[10px] text-muted font-mono tracking-wider">单词大作战</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1.5">
          {user ? (
            <>
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href))
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={`relative font-medium transition-all ${
                        isActive
                          ? "bg-surface-card text-primary font-semibold shadow-xs border-primary/20"
                          : "text-body hover:text-ink"
                      }`}
                    >
                      <span className="mr-1.5 text-xs">{link.icon}</span>
                      {link.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
                      )}
                    </Button>
                  </Link>
                )
              })}

              {/* Sound toggle button */}
              <button
                onClick={toggleSound}
                className={`p-2 rounded-md transition-colors text-sm ml-1 ${
                  soundEnabled
                    ? "text-primary hover:bg-surface-card"
                    : "text-muted-soft hover:bg-surface-card"
                }`}
                title={soundEnabled ? "静音音效" : "开启音效"}
                aria-label="音效开关"
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>

              {/* User Profile */}
              <div className="flex items-center gap-2.5 ml-3 pl-3 border-l border-hairline">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent-amber rounded-full flex items-center justify-center text-on-primary text-xs font-semibold shadow-xs">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-ink max-w-[100px] truncate">{user.username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-xs text-muted hover:text-error transition-colors px-2"
                >
                  退出
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Sound toggle for guest */}
              <button
                onClick={toggleSound}
                className="p-2 rounded-md hover:bg-surface-card transition-colors text-sm mr-2 text-muted"
                title={soundEnabled ? "静音音效" : "开启音效"}
                aria-label="音效开关"
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>
              <Link href="/login">
                <Button variant="ghost" size="sm">登录</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm" className="shadow-xs">免费注册</Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-md hover:bg-surface-card transition-colors text-sm text-muted"
            aria-label="音效开关"
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
          <button
            className="flex flex-col justify-center gap-1.5 w-8 h-8 p-1 rounded-md hover:bg-surface-soft"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
          >
            <span className={`block w-5 h-0.5 bg-ink transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-ink transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-ink transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-hairline bg-canvas/95 backdrop-blur-md px-4 py-4 space-y-1 shadow-lg">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-surface-card rounded-lg border border-hairline-soft">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-on-primary font-semibold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{user.username}</p>
                  <p className="text-[11px] text-muted">在线竞技中</p>
                </div>
              </div>
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className={`w-full justify-start ${isActive ? "text-primary font-semibold bg-surface-card" : ""}`}
                    >
                      <span className="mr-2">{link.icon}</span>
                      {link.label}
                    </Button>
                  </Link>
                )
              })}
              <div className="pt-2 mt-2 border-t border-hairline">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-error hover:bg-error/10"
                  onClick={() => {
                    logout()
                    setMenuOpen(false)
                  }}
                >
                  🚪 退出登录
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">登录</Button>
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">免费注册</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
