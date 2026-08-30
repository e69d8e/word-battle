"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { useSpeech } from "@/hooks/useSpeech"
import { sound } from "@/lib/sound"
import type { Question, QuestionType } from "@/types"
import { Button } from "@/components/ui/button"

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  onAnswer: (answer: string, timeMs: number) => void
  disabled?: boolean
}

function QuestionTypeLabel({ type }: { type: QuestionType }) {
  const labels = {
    en2cn: { text: "英译中", icon: "🇬🇧 → 🇨🇳", color: "bg-accent-teal/15 text-accent-teal border-accent-teal/20" },
    cn2en: { text: "中译英", icon: "🇨🇳 → 🇬🇧", color: "bg-accent-amber/15 text-accent-amber border-accent-amber/20" },
    listening: { text: "听音选词", icon: "🔊", color: "bg-primary/15 text-primary border-primary/20" },
  }
  const label = labels[type]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs", label.color)}>
      <span>{label.icon}</span>
      <span>{label.text}</span>
    </span>
  )
}

export const QuestionCard = React.memo(function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const startTimeRef = useRef<number>(0)
  const { speak } = useSpeech()

  // Set start time on mount
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [])

  const playPronunciation = useCallback(() => {
    setIsPlayingAudio(true)
    speak(question.word.word)
    setTimeout(() => setIsPlayingAudio(false), 1200)
  }, [question.word.word, speak])

  // Autoplay for listening question type
  useEffect(() => {
    if (question.type === "listening") {
      const timer = setTimeout(() => {
        playPronunciation()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [question.id, question.type, playPronunciation])

  const handleSelect = useCallback(
    (option: string) => {
      if (selected || disabled) return
      setSelected(option)
      setShowResult(true)
      const timeMs = Date.now() - startTimeRef.current

      // Sound effect
      if (option === question.correctAnswer) {
        sound.playCorrect()
      } else {
        sound.playWrong()
      }

      onAnswer(option, timeMs)
    },
    [selected, disabled, question.correctAnswer, onAnswer]
  )

  // Keyboard shortcut listener (A/B/C/D or 1/2/3/4, Space to play pronunciation)
  useEffect(() => {
    if (selected || disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const key = e.key.toUpperCase()

      // Pronunciation on Space
      if (e.code === "Space" || key === " ") {
        e.preventDefault()
        playPronunciation()
        return
      }

      // Map keys to option indices
      let optionIndex = -1
      if (key === "A" || key === "1") optionIndex = 0
      else if (key === "B" || key === "2") optionIndex = 1
      else if (key === "C" || key === "3") optionIndex = 2
      else if (key === "D" || key === "4") optionIndex = 3

      if (optionIndex >= 0 && optionIndex < question.options.length) {
        e.preventDefault()
        handleSelect(question.options[optionIndex])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selected, disabled, question.options, handleSelect, playPronunciation])

  const isEnglishWordPrompt = question.type === "en2cn" || question.type === "listening"

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-hairline-soft pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-muted bg-surface-cream-strong px-2.5 py-1 rounded-md">
            QUESTION {questionNumber}/{totalQuestions}
          </span>
          <QuestionTypeLabel type={question.type} />
        </div>

        {/* Pronunciation trigger button */}
        {isEnglishWordPrompt && (
          <button
            onClick={playPronunciation}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-xs",
              isPlayingAudio
                ? "bg-primary text-on-primary scale-105"
                : "bg-surface-card hover:bg-surface-cream-strong text-ink border border-hairline"
            )}
            title="朗读单词发音 (快捷键: 空格)"
          >
            <span className={isPlayingAudio ? "animate-bounce" : ""}>🔊</span>
            <span className="hidden sm:inline">{isPlayingAudio ? "发音中..." : "朗读"}</span>
          </button>
        )}
      </div>

      {/* Question Prompt Centerpiece */}
      <div className="text-center py-6 md:py-8 bg-surface-soft/60 rounded-2xl border border-hairline-soft/80 relative overflow-hidden">
        {question.type === "listening" ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={playPronunciation}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-sm transition-all duration-300",
                isPlayingAudio
                  ? "bg-primary text-on-primary scale-110 shadow-primary/30 shadow-lg ring-4 ring-primary/20"
                  : "bg-canvas text-primary hover:scale-105 border border-hairline"
              )}
            >
              <span className={isPlayingAudio ? "animate-pulse" : ""}>🔊</span>
            </button>
            <p className="text-sm font-medium text-muted">点击或按 [空格] 播放音频</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-3">
              <p className="font-display text-4xl md:text-5xl font-semibold text-ink tracking-tight">
                {question.type === "en2cn" ? question.word.word : question.word.meaningCn}
              </p>
              {question.type === "en2cn" && (
                <button
                  onClick={playPronunciation}
                  className="p-2 rounded-full hover:bg-canvas text-muted hover:text-primary transition-colors text-lg"
                  title="播放发音"
                >
                  🔊
                </button>
              )}
            </div>
            {question.type === "en2cn" && question.word.phonetic && (
              <p className="text-muted-soft text-base font-mono mt-1">{question.word.phonetic}</p>
            )}
          </div>
        )}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 gap-3">
        {question.options.map((option, index) => {
          const isSelected = selected === option
          const isCorrect = option === question.correctAnswer
          const showCorrect = showResult && isCorrect
          const showWrong = showResult && isSelected && !isCorrect
          const keyLetter = String.fromCharCode(65 + index)

          return (
            <Button
              key={index}
              variant="outline"
              className={cn(
                "w-full justify-start text-left h-auto py-3.5 px-4 md:px-5 text-base transition-all duration-200 group relative rounded-xl",
                !showResult && "hover:border-primary/50 hover:bg-canvas hover:shadow-xs active:scale-[0.99]",
                showCorrect && "border-success bg-success/15 text-success font-semibold ring-2 ring-success/30 shadow-xs",
                showWrong && "border-error bg-error/15 text-error font-semibold animate-shake shadow-xs",
                showResult && !isCorrect && !isSelected && "opacity-40"
              )}
              onClick={() => handleSelect(option)}
              disabled={!!selected || disabled}
            >
              {/* Option Keycap Badge */}
              <span
                className={cn(
                  "kbd-badge mr-3 shrink-0 transition-colors",
                  showCorrect
                    ? "bg-success text-on-primary border-success"
                    : showWrong
                    ? "bg-error text-on-primary border-error"
                    : "group-hover:border-primary/40 group-hover:text-primary"
                )}
              >
                {keyLetter}
              </span>

              {/* Option Text */}
              <span className="flex-1 text-sm md:text-base leading-snug">{option}</span>

              {/* Status Icons */}
              {showCorrect && (
                <span className="text-success font-bold text-lg ml-2 shrink-0 animate-countdown-pop">
                  ✓
                </span>
              )}
              {showWrong && (
                <span className="text-error font-bold text-lg ml-2 shrink-0">
                  ✗
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/* Keyboard Helper Hint */}
      {!showResult && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-soft pt-1">
          <span className="inline-flex items-center gap-1">
            <span className="kbd-badge text-[10px]">A-D</span> 或 <span className="kbd-badge text-[10px]">1-4</span> 快速选词
          </span>
          {isEnglishWordPrompt && (
            <span className="inline-flex items-center gap-1">
              <span className="kbd-badge text-[10px]">Space</span> 朗读
            </span>
          )}
        </div>
      )}

      {/* Detailed Explanation upon answering */}
      {showResult && (
        <div
          className={cn(
            "p-5 rounded-xl border animate-countdown-pop transition-all",
            selected === question.correctAnswer
              ? "bg-success/10 border-success/30"
              : "bg-error/10 border-error/30"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-base text-ink flex items-center gap-1.5">
              <span>{selected === question.correctAnswer ? "🎉 回答正确！" : "⚠️ 回答错误"}</span>
            </p>
            <button
              onClick={playPronunciation}
              className="text-xs text-primary hover:underline flex items-center gap-1 bg-canvas px-2.5 py-1 rounded-md border border-hairline"
            >
              <span>🔊</span> 听发音
            </button>
          </div>

          <div className="bg-canvas/80 p-3 rounded-lg border border-hairline-soft space-y-1 text-sm">
            <p className="font-semibold text-ink flex items-center gap-2">
              <span>{question.word.word}</span>
              {question.word.phonetic && <span className="text-xs font-mono text-muted font-normal">{question.word.phonetic}</span>}
            </p>
            <p className="text-body text-xs md:text-sm">
              <span className="text-primary font-medium">{question.word.meaningCn}</span>
              {question.word.meaning && <span className="text-muted ml-2">({question.word.meaning})</span>}
            </p>
            {question.word.example && (
              <p className="text-xs text-muted-soft pt-1 italic border-t border-hairline-soft mt-1.5">
                &ldquo;{question.word.example}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
