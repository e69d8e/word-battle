"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/authStore"

export default function Home() {
  const { user } = useAuthStore()

  const features = [
    {
      icon: "🤖",
      title: "人机对战",
      description: "与AI进行单词PK，适合单人练习和自测",
    },
    {
      icon: "⚡",
      title: "实时对战",
      description: "与朋友实时比拼答题速度和正确率",
    },
    {
      icon: "🎯",
      title: "多种题型",
      description: "英译中、中译英、听音选词等多种挑战模式",
    },
    {
      icon: "📊",
      title: "排行榜",
      description: "查看全球排名，激发学习动力",
    },
  ]

  const levels = [
    { name: "CET-4", desc: "大学英语四级", accent: "bg-accent-teal" },
    { name: "CET-6", desc: "大学英语六级", accent: "bg-primary" },
    { name: "TOEFL", desc: "托福词汇", accent: "bg-accent-amber" },
    { name: "IELTS", desc: "雅思词汇", accent: "bg-surface-dark" },
  ]

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section — Cream canvas with serif headline */}
      <section className="bg-canvas">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-surface-card rounded-full px-4 py-2 mb-6">
                <span className="animate-bounce">⚔️</span>
                <span className="text-sm font-medium text-body-strong">英语单词PK对战平台</span>
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-medium text-ink leading-[1.05] tracking-[-0.02em] mb-6">
                Word Battle
              </h1>
              <p className="text-lg md:text-xl text-muted mb-8 max-w-lg leading-relaxed">
                与朋友一起PK英语单词，在游戏中提升词汇量，让学习变得更有趣！
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <Link href="/game">
                    <Button size="lg" className="text-base px-8 py-4">
                      🚀 开始PK
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/register">
                      <Button size="lg" className="text-base px-8 py-4">
                        🎮 免费注册
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="lg" variant="outline" className="text-base px-8 py-4">
                        登录账号
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right — Dark product mockup card */}
            <div className="hidden lg:block">
              <div className="bg-surface-dark rounded-xl p-8 text-on-dark">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-error/60"></div>
                  <div className="w-3 h-3 rounded-full bg-warning/60"></div>
                  <div className="w-3 h-3 rounded-full bg-success/60"></div>
                  <span className="ml-3 text-on-dark-soft text-xs font-mono">game.tsx</span>
                </div>
                <div className="font-mono text-sm space-y-3 text-on-dark-soft">
                  <p><span className="text-accent-teal">const</span> <span className="text-on-dark">question</span> = <span className="text-accent-amber">generateQuestion</span>();</p>
                  <p><span className="text-accent-teal">const</span> <span className="text-on-dark">answer</span> = <span className="text-accent-amber">playerSelect</span>();</p>
                  <p><span className="text-accent-teal">if</span> (<span className="text-on-dark">answer</span> === <span className="text-on-dark">correct</span>) {'{'}</p>
                  <p className="pl-4"><span className="text-on-dark">score</span> += <span className="text-accent-amber">100</span>;</p>
                  <p className="pl-4"><span className="text-on-dark">combo</span>++;</p>
                  <p>{'}'}</p>
                  <p className="mt-4 text-success">{"// ✓ 回答正确！+150分"}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-surface-dark-elevated flex items-center justify-between">
                  <span className="text-xs text-on-dark-soft">Round 7/10</span>
                  <span className="text-xs text-accent-teal">● 正在对战</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-start gap-12 mt-16 pt-8 border-t border-hairline-soft">
            <div>
              <p className="font-display text-3xl font-medium text-ink">18000+</p>
              <p className="text-muted text-sm mt-1">核心词汇</p>
            </div>
            <div>
              <p className="font-display text-3xl font-medium text-ink">4种</p>
              <p className="text-muted text-sm mt-1">词汇级别</p>
            </div>
            <div>
              <p className="font-display text-3xl font-medium text-ink">3种</p>
              <p className="text-muted text-sm mt-1">题型模式</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features — Cream card grid */}
      <section className="bg-surface-soft">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-3 tracking-tight">核心功能</h2>
          <p className="text-center text-muted mb-12">多种模式，满足不同学习需求</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature) => (
              <Card key={feature.title} className="hover:shadow-subtle transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-5 bg-surface-cream-strong rounded-lg flex items-center justify-center text-2xl">
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-lg font-medium mb-2 text-ink">{feature.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Word Levels — Clean grid on canvas */}
      <section className="bg-canvas">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-center text-ink mb-3 tracking-tight">词汇级别</h2>
          <p className="text-center text-muted mb-12">从基础到高级，循序渐进</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {levels.map((level) => (
              <div
                key={level.name}
                className="group cursor-pointer"
              >
                <div className="bg-surface-card border border-hairline-soft rounded-lg p-5 md:p-6 transform group-hover:scale-[1.02] transition-transform">
                  <div className={`w-10 h-10 ${level.accent} rounded-md flex items-center justify-center mb-4`}>
                    <span className="text-on-primary font-bold text-sm">{level.name.charAt(0)}</span>
                  </div>
                  <p className="font-display text-xl md:text-2xl font-medium text-ink mb-1">{level.name}</p>
                  <p className="text-muted text-sm">{level.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Coral callout band */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-24">
        <div className="bg-primary rounded-xl px-8 py-16 md:px-16 md:py-20 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-medium text-on-primary mb-4 tracking-tight">准备好挑战了吗？</h2>
          <p className="text-on-primary/80 mb-8 text-lg">立即开始你的英语单词PK之旅！</p>
          <Link href={user ? "/game" : "/register"}>
            <Button size="lg" variant="secondary" className="bg-canvas text-ink hover:bg-surface-soft text-base px-10 py-4">
              {user ? "开始游戏" : "立即注册"}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer — Dark navy */}
      <footer className="bg-surface-dark text-on-dark-soft py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <span className="text-on-primary font-bold text-xs">W</span>
            </div>
            <span className="font-display text-lg font-medium text-on-dark">Word Battle</span>
          </div>
          <div className="border-t border-surface-dark-elevated pt-8">
            <p className="text-sm">© 2026 Word Battle. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
