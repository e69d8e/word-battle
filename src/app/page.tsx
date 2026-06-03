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
    { name: "CET-4", desc: "大学英语四级", color: "from-green-400 to-emerald-500" },
    { name: "CET-6", desc: "大学英语六级", color: "from-blue-400 to-cyan-500" },
    { name: "TOEFL", desc: "托福词汇", color: "from-purple-400 to-pink-500" },
    { name: "IELTS", desc: "雅思词汇", color: "from-orange-400 to-red-500" },
  ]

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="relative max-w-6xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
            <span className="animate-bounce">⚔️</span>
            <span className="text-sm font-medium">英语单词PK对战平台</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-yellow-200">
            Word Battle
          </h1>
          <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto">
            与朋友一起PK英语单词，在游戏中提升词汇量，让学习变得更有趣！
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/game">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-yellow-100 shadow-xl text-lg px-8 py-4">
                  🚀 开始PK
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-white text-purple-600 hover:bg-yellow-100 shadow-xl text-lg px-8 py-4">
                    🎮 免费注册
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8 py-4">
                    登录账号
                  </Button>
                </Link>
              </>
            )}
          </div>
          {/* Stats */}
          <div className="flex justify-center gap-12 mt-16">
            <div className="text-center">
              <p className="text-3xl font-bold">500+</p>
              <p className="text-white/60 text-sm">核心词汇</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">4种</p>
              <p className="text-white/60 text-sm">词汇级别</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">3种</p>
              <p className="text-white/60 text-sm">题型模式</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">核心功能</h2>
        <p className="text-center text-gray-500 mb-12">多种模式，满足不同学习需求</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl flex items-center justify-center text-3xl">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Word Levels */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">词汇级别</h2>
          <p className="text-center text-gray-500 mb-12">从基础到高级，循序渐进</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {levels.map((level) => (
              <div
                key={level.name}
                className="group cursor-pointer"
              >
                <div className={`bg-gradient-to-br ${level.color} rounded-2xl p-6 text-white transform group-hover:scale-105 transition-transform`}>
                  <p className="text-2xl font-bold mb-1">{level.name}</p>
                  <p className="text-white/80 text-sm">{level.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">准备好挑战了吗？</h2>
        <p className="text-gray-500 mb-8">立即开始你的英语单词PK之旅！</p>
        <Link href={user ? "/game" : "/register"}>
          <Button size="lg" variant="primary" className="text-lg px-10 py-4">
            {user ? "开始游戏" : "立即注册"}
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>© 2024 Word Battle. All rights reserved.</p>
          <p className="mt-2">用心做产品，让英语学习更有趣</p>
        </div>
      </footer>
    </div>
  )
}
