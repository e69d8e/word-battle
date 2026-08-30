"use client"

import { cn } from "@/lib/utils"

interface TimerProps {
  seconds: number
  total: number
}

export function Timer({ seconds, total }: TimerProps) {
  const progress = Math.max(0, Math.min(100, (seconds / total) * 100))
  const isUrgent = seconds <= 5
  const isWarning = seconds <= 8 && seconds > 5

  return (
    <div className="flex items-center gap-3 bg-surface-card/80 backdrop-blur-sm border border-hairline px-4 py-2 rounded-full shadow-xs">
      <span className="text-base" role="img" aria-label="clock">
        {isUrgent ? "⏳" : "⏱️"}
      </span>

      {/* Progress Bar Container */}
      <div className="relative h-2.5 w-36 md:w-48 overflow-hidden rounded-full bg-surface-cream-strong border border-hairline-soft">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear rounded-full",
            isUrgent
              ? "bg-gradient-to-r from-error to-error/80 shadow-[0_0_8px_rgba(198,69,69,0.5)]"
              : isWarning
              ? "bg-gradient-to-r from-accent-amber to-warning"
              : "bg-gradient-to-r from-primary to-accent-teal"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Numerical Countdown */}
      <div className="flex items-baseline gap-0.5 min-w-[2.5rem] justify-end">
        <span
          className={cn(
            "text-lg font-bold tabular-nums font-mono transition-colors",
            isUrgent ? "text-error animate-pulse-urgent font-black text-xl" : "text-ink"
          )}
        >
          {seconds}
        </span>
        <span className="text-xs text-muted font-medium">s</span>
      </div>
    </div>
  )
}
