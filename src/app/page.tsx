"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/authStore"
import { useSpeech } from "@/hooks/useSpeech"
import { sound } from "@/lib/sound"

const DEMO_QUESTIONS = [
  {
    word: "ubiquitous",
    phonetic: "/juːˈbɪkwɪtəs/",
    meaning: "present, appearing, or found everywhere",
    correct: "无处不在的；普遍存在的",
    options: ["无处不在的；普遍存在的", "雄心勃勃的；野心勃勃的", "难以捉摸的；模糊不清的", "独一无二的；举世无双的"],
  },
  {
    word: "resilient",
    phonetic: "/rɪˈzɪliənt/",
    meaning: "able to withstand or recover quickly from difficult conditions",
    correct: "有韧性的；能迅速恢复的",
    options: ["犹豫不决的；摇摆不定的", "有韧性的；能迅速恢复的", "冷漠无情的；麻木不仁的", "极其脆弱的；易碎的"],
  },
  {
    word: "meticulous",
    phonetic: "/məˈtɪkjələs/",
    meaning: "showing great attention to detail; very careful and precise",
    correct: "一丝不苟的；极其细致的",
    options: ["粗心大意的；鲁莽的", "随心所欲的；任性的", "一丝不苟的；极其细致的", "平淡无奇的；乏味的"],
  },
]

export default function Home() {
  const { user } = useAuthStore()
  const { speak } = useSpeech()

  const [demoIndex, setDemoIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [demoScore, setDemoScore] = useState(140)
  const [demoCombo, setDemoCombo] = useState(1)
  const [showFloatingScore, setShowFloatingScore] = useState(false)

  const currentDemo = DEMO_QUESTIONS[demoIndex]

  const handleDemoSelect = (opt: string) => {
    if (selectedOption) return
    setSelectedOption(opt)

    if (opt === currentDemo.correct) {
      sound.playCorrect()
      setDemoScore((s) => s + 150)
      setDemoCombo((c) => c + 1)
      setShowFloatingScore(true)
      setTimeout(() => setShowFloatingScore(false), 1200)
    } else {
      sound.playWrong()
      setDemoCombo(0)
    }
  }

  const handleNextDemo = () => {
    sound.playClick()
    setSelectedOption(null)
    setShowFloatingScore(false)
    setDemoIndex((prev) => (prev + 1) % DEMO_QUESTIONS.length)
  }

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
      {/* Hero Section */}
      <section className="bg-canvas relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 bg-accent-teal/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left — Text */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 bg-surface-card border border-hairline rounded-full px-4 py-1.5 shadow-2xs">
                <span className="animate-bounce">⚔️</span>
                <span className="text-xs font-semibold text-body-strong tracking-wide">
                  全新 2.0 极速竞技与错题复习模式
                </span>
              </div>

              <h1 className="font-display text-5xl md:text-7xl font-bold text-ink leading-[1.05] tracking-tight">
                Word Battle
              </h1>

              <p className="text-lg md:text-xl text-muted leading-relaxed max-w-lg">
                专为四六级、托福、雅思考生打造的单词竞技对战平台。在毫秒必争的 PK 中强化词汇记忆，告别死记硬背！
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {user ? (
                  <Link href="/game">
                    <Button size="lg" className="text-base px-8 py-4 shadow-sm w-full sm:w-auto">
                      🚀 开启对战
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/game">
                      <Button size="lg" className="text-base px-8 py-4 shadow-sm w-full sm:w-auto">
                        🎮 立即试玩对战
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="lg" variant="outline" className="text-base px-8 py-4 w-full sm:w-auto">
                        免费注册账号
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-hairline-soft">
                <div>
                  <p className="font-display text-3xl font-bold text-ink">18000+</p>
                  <p className="text-muted text-xs mt-0.5">核心大纲词汇</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-ink">4 阶</p>
                  <p className="text-muted text-xs mt-0.5">真题考试分级</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-primary">0ms</p>
                  <p className="text-muted text-xs mt-0.5">全键盘极速作答</p>
                </div>
              </div>
            </div>

            {/* Right — Interactive Live PK Mini Preview */}
            <div className="lg:col-span-6">
              <div className="bg-surface-dark text-on-dark rounded-2xl p-6 md:p-8 shadow-2xl border border-surface-dark-elevated relative overflow-hidden">
                {/* Floating score indicator */}
                {showFloatingScore && (
                  <div className="absolute top-8 right-8 animate-float-score font-mono font-black text-xl text-success bg-canvas px-3 py-1 rounded-full border border-success/40 shadow-lg z-30">
                    +150 分 🔥 Combo x{demoCombo}
                  </div>
                )}

                {/* Top status bar */}
                <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-success/80" />
                    <span className="ml-2 text-xs font-mono text-on-dark-soft">LIVE DEMO · 试玩体验</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-accent-teal font-semibold">
                      得分: {demoScore}
                    </span>
                    {demoCombo >= 2 && (
                      <span className="text-[11px] bg-accent-amber/20 text-accent-amber px-2 py-0.5 rounded-full font-bold animate-combo-pulse">
                        🔥 {demoCombo} 连击
                      </span>
                    )}
                  </div>
                </div>

                {/* Question word prompt */}
                <div className="text-center py-4 space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-display text-3xl md:text-4xl font-bold text-on-dark tracking-tight">
                      {currentDemo.word}
                    </span>
                    <button
                      onClick={() => speak(currentDemo.word)}
                      className="p-1.5 rounded-full bg-surface-dark-elevated hover:bg-surface-dark-soft text-primary transition-colors text-sm"
                      title="点击发音"
                    >
                      🔊
                    </button>
                  </div>
                  <p className="text-xs font-mono text-on-dark-soft">{currentDemo.phonetic}</p>
                </div>

                {/* Options list */}
                <div className="space-y-2 mt-4">
                  {currentDemo.options.map((opt, i) => {
                    const isSelected = selectedOption === opt
                    const isCorrect = opt === currentDemo.correct
                    const showCorrect = selectedOption && isCorrect
                    const showWrong = isSelected && !isCorrect
                    const letter = String.fromCharCode(65 + i)

                    return (
                      <button
                        key={i}
                        onClick={() => handleDemoSelect(opt)}
                        disabled={!!selectedOption}
                        className={`w-full text-left p-3 rounded-xl text-xs md:text-sm font-medium transition-all flex items-center gap-3 border ${
                          showCorrect
                            ? "bg-success/20 border-success text-success font-bold"
                            : showWrong
                            ? "bg-error/20 border-error text-error font-bold"
                            : "bg-surface-dark-elevated border-surface-dark-elevated text-on-dark hover:border-primary/40 hover:bg-surface-dark-soft"
                        }`}
                      >
                        <span className="kbd-badge bg-surface-dark text-on-dark-soft border-surface-dark-soft text-[10px]">
                          {letter}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {showCorrect && <span>✓</span>}
                        {showWrong && <span>✗</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Action footer */}
                <div className="mt-6 pt-4 border-t border-surface-dark-elevated flex items-center justify-between">
                  <span className="text-[11px] text-on-dark-soft">
                    {selectedOption ? (selectedOption === currentDemo.correct ? "🎉 答对啦！" : "💡 再接再厉！") : "点击选项即可体验即时音效与得分"}
                  </span>
                  <button
                    onClick={handleNextDemo}
                    className="text-xs text-primary hover:text-accent-amber font-semibold transition-colors flex items-center gap-1"
                  >
                    <span>换一题</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
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
              <Link
                key={level.name}
                href="/game"
                className="group cursor-pointer"
              >
                <div className="bg-surface-card border border-hairline-soft rounded-lg p-5 md:p-6 transform group-hover:scale-[1.02] transition-transform">
                  <div className={`w-10 h-10 ${level.accent} rounded-md flex items-center justify-center mb-4`}>
                    <span className="text-on-primary font-bold text-sm">{level.name.charAt(0)}</span>
                  </div>
                  <p className="font-display text-xl md:text-2xl font-medium text-ink mb-1">{level.name}</p>
                  <p className="text-muted text-sm">{level.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Coral callout band */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-24">
        <div className="bg-primary rounded-xl px-8 py-16 md:px-16 md:py-20 text-center shadow-lg">
          <h2 className="font-display text-2xl md:text-4xl font-medium text-on-primary mb-4 tracking-tight">准备好挑战了吗？</h2>
          <p className="text-on-primary/90 mb-8 text-lg">立即开启单词 PK 之旅，让背单词如打游戏般让人上瘾！</p>
          <Link href={user ? "/game" : "/register"}>
            <Button size="lg" variant="secondary" className="bg-canvas text-ink hover:bg-surface-soft text-base px-10 py-4 shadow-sm font-semibold">
              {user ? "立即开始游戏" : "免费注册加入对战"}
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
