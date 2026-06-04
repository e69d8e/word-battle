import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "danger" | "ghost" | "outline"
  size?: "sm" | "md" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {
            /* Primary — coral CTA */
            "bg-primary text-on-primary hover:bg-primary-active focus:ring-primary rounded-md": variant === "default" || variant === "primary",
            /* Secondary — cream with hairline */
            "bg-canvas text-ink border border-hairline hover:bg-surface-soft focus:ring-primary rounded-md": variant === "secondary",
            /* Danger — error red */
            "bg-error text-on-primary hover:bg-error/90 focus:ring-error rounded-md": variant === "danger",
            /* Ghost — transparent */
            "bg-transparent text-body hover:bg-surface-soft focus:ring-primary rounded-md": variant === "ghost",
            /* Outline — hairline border */
            "border border-hairline bg-transparent text-body hover:bg-surface-soft focus:ring-primary rounded-md": variant === "outline",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
