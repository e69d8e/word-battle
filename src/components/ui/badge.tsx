import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "coral"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
        {
          "bg-surface-card text-ink": variant === "default",
          "bg-success/15 text-success": variant === "success",
          "bg-warning/15 text-warning": variant === "warning",
          "bg-error/15 text-error": variant === "danger",
          "bg-accent-teal/15 text-accent-teal": variant === "info",
          "bg-primary text-on-primary": variant === "coral",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
