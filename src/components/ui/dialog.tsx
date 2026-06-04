"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: React.ReactNode
}

function Dialog({ open, onClose, title, description, children }: DialogProps) {
  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          "relative z-10 w-full max-w-sm mx-4",
          "bg-surface-card border border-hairline-soft rounded-xl shadow-lg",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <div className="p-6 text-center">
          {title && (
            <h3 className="font-display text-lg font-medium text-ink mb-2">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted mb-6">{description}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
Dialog.displayName = "Dialog"

interface AlertDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmText?: string
}

function AlertDialog({ open, onClose, title, description, confirmText = "确定" }: AlertDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <Button variant="primary" className="w-full" onClick={onClose}>
        {confirmText}
      </Button>
    </Dialog>
  )
}
AlertDialog.displayName = "AlertDialog"

export { Dialog, AlertDialog }
