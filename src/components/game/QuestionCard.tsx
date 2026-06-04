"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { useSpeech } from "@/hooks/useSpeech"
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
    en2cn: { text: "英译中", icon: "🇬🇧 → 🇨🇳", color: "bg-accent-teal/15 text-accent-teal" },
    cn2en: { text: "中译英", icon: "🇨🇳 → 🇬🇧", color: "bg-accent-amber/15 text-accent-amber" },
    listening: { text: "听音选词", icon: "🔊", color: "bg-primary/15 text-primary" },
  }
  const label = labels[type]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", label.color)}>
      <span>{label.icon}</span>
      <span>{label.text}</span>
    </span>
  )
}

export function QuestionCard({ question, questionNumber, totalQuestions, onAnswer, disabled }: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const startTimeRef = useRef<number>(0)
  const { speak } = useSpeech()

  // Set start time on mount
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (question.type === "listening") {
      const timer = setTimeout(() => {
        speak(question.word.word)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [question.id, question.type, question.word.word, speak])

  const handleSelect = useCallback(
    (option: string) => {
      if (selected || disabled) return
      setSelected(option)
      setShowResult(true)
      const timeMs = Date.now() - startTimeRef.current
      onAnswer(option, timeMs)
    },
    [selected, disabled, onAnswer]
  )

  const prompt = question.type === "en2cn"
    ? question.word.word
    : question.type === "cn2en"
    ? question.word.meaningCn
    : "🔊 点击播放按钮听发音"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            第 {questionNumber}/{totalQuestions} 题
          </span>
          <QuestionTypeLabel type={question.type} />
        </div>
        {question.type === "listening" && (
          <button
            onClick={() => speak(question.word.word)}
            className="p-2 rounded-full hover:bg-surface-soft transition-colors"
            title="播放发音"
          >
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8H4a1 1 0 00-1 1v6a1 1 0 001 1h2.5l4 4V4l-4 4z" />
            </svg>
          </button>
        )}
      </div>

      {/* Question Prompt */}
      <div className="text-center py-8">
        <p className="font-display text-4xl font-medium text-ink mb-2 tracking-tight">
          {prompt}
        </p>
        {question.type === "en2cn" && question.word.phonetic && (
          <p className="text-muted text-lg">{question.word.phonetic}</p>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {question.options.map((option, index) => {
          const isSelected = selected === option
          const isCorrect = option === question.correctAnswer
          const showCorrect = showResult && isCorrect
          const showWrong = showResult && isSelected && !isCorrect

          return (
            <Button
              key={index}
              variant="outline"
              className={cn(
                "w-full justify-start text-left h-auto py-4 px-5 text-base",
                !showResult && "hover:border-primary/40 hover:bg-primary/5",
                showCorrect && "border-success bg-success/10 text-success",
                showWrong && "border-error bg-error/10 text-error",
                showResult && !isCorrect && !isSelected && "opacity-40"
              )}
              onClick={() => handleSelect(option)}
              disabled={!!selected || disabled}
            >
              <span className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center mr-3 text-sm font-medium shrink-0 text-muted">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option}</span>
              {showCorrect && (
                <svg className="w-5 h-5 text-success ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {showWrong && (
                <svg className="w-5 h-5 text-error ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </Button>
          )
        })}
      </div>

      {/* Explanation */}
      {showResult && (
        <div className={cn(
          "p-5 rounded-lg",
          selected === question.correctAnswer
            ? "bg-success/10 border border-success/20"
            : "bg-error/10 border border-error/20"
        )}>
          <p className="font-medium mb-1 text-ink">
            {selected === question.correctAnswer ? "✅ 回答正确！" : "❌ 回答错误"}
          </p>
          <p className="text-sm text-body">
            <span className="font-medium">{question.word.word}</span>
            {question.word.phonetic && <span className="ml-2 text-muted">{question.word.phonetic}</span>}
          </p>
          <p className="text-sm text-body mt-1">
            {question.word.meaningCn} - {question.word.meaning}
          </p>
          {question.word.example && (
            <p className="text-xs text-muted mt-2 italic">
              &quot;{question.word.example}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  )
}
