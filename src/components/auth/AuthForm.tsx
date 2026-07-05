"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AuthField {
  id: string
  label: string
  type: string
  placeholder: string
}

interface AuthFormProps {
  icon: React.ReactNode
  title: string
  description: string
  fields: AuthField[]
  submitLabel: string
  loadingLabel: string
  onSubmit: (values: Record<string, string>) => Promise<boolean | string>
  footer: React.ReactNode
  extraValidation?: (values: Record<string, string>) => string | null
}

export function AuthForm({
  icon,
  title,
  description,
  fields,
  submitLabel,
  loadingLabel,
  onSubmit,
  footer,
  extraValidation,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.id, ""]))
  )
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (extraValidation) {
      const validationError = extraValidation(values)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setIsLoading(true)
    try {
      const result = await onSubmit(values)
      if (result !== true) {
        setError(typeof result === "string" ? result : "操作失败，请稍后重试")
      }
    } catch {
      setError("操作失败，请稍后重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-md text-sm text-error">
                {error}
              </div>
            )}
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label htmlFor={field.id} className="text-sm font-medium text-body-strong">
                  {field.label}
                </label>
                <Input
                  id={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={values[field.id]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  required
                />
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? loadingLabel : submitLabel}
            </Button>
            {footer}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
