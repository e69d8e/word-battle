"use client"

import { cn } from "@/lib/utils"

interface TimerProps {
  seconds: number
  total: number
}

export function Timer({ seconds, total }: TimerProps) {
  const progress = (seconds / total) * 100
  const isLow = seconds <= 5

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-32 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear rounded-full",
            isLow ? "bg-red-500" : "bg-blue-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span
        className={cn(
          "text-lg font-bold tabular-nums min-w-[2.5rem] text-center",
          isLow ? "text-red-500 animate-pulse" : "text-gray-700"
        )}
      >
        {seconds}s
      </span>
    </div>
  )
}
