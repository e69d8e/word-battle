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
    en2cn: { text: "英译中", icon: "🇬🇧 → 🇨🇳", color: "bg-blue-100 text-blue-700" },
    cn2en: { text: "中译英", icon: "🇨🇳 → 🇬🇧", color: "bg-green-100 text-green-700" },
    listening: { text: "听音选词", icon: "🔊", color: "bg-purple-100 text-purple-700" },
  }
  const label = labels[type]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", label.color)}>
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
  }, [question, speak])

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
          <span className="text-sm text-gray-500">
            第 {questionNumber}/{totalQuestions} 题
          </span>
          <QuestionTypeLabel type={question.type} />
        </div>
        {question.type === "listening" && (
          <button
            onClick={() => speak(question.word.word)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="播放发音"
          >
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8H4a1 1 0 00-1 1v6a1 1 0 001 1h2.5l4 4V4l-4 4z" />
            </svg>
          </button>
        )}
      </div>

      {/* Question Prompt */}
      <div className="text-center py-8">
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {prompt}
        </p>
        {question.type === "en2cn" && question.word.phonetic && (
          <p className="text-gray-500 text-lg">{question.word.phonetic}</p>
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
                !showResult && "hover:border-blue-400 hover:bg-blue-50",
                showCorrect && "border-green-500 bg-green-50 text-green-700",
                showWrong && "border-red-500 bg-red-50 text-red-700",
                showResult && !isCorrect && !isSelected && "opacity-50"
              )}
              onClick={() => handleSelect(option)}
              disabled={!!selected || disabled}
            >
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 text-sm font-medium shrink-0">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option}</span>
              {showCorrect && (
                <svg className="w-5 h-5 text-green-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {showWrong && (
                <svg className="w-5 h-5 text-red-500 ml-2" fill="currentColor" viewBox="0 0 20 20">
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
          "p-4 rounded-lg",
          selected === question.correctAnswer ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
        )}>
          <p className="font-medium mb-1">
            {selected === question.correctAnswer ? "✅ 回答正确！" : "❌ 回答错误"}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{question.word.word}</span>
            {question.word.phonetic && <span className="ml-2 text-gray-400">{question.word.phonetic}</span>}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {question.word.meaningCn} - {question.word.meaning}
          </p>
          {question.word.example && (
            <p className="text-xs text-gray-400 mt-2 italic">
              &quot;{question.word.example}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  )
}
