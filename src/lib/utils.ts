import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getRandomItems<T>(array: T[], count: number): T[] {
  const n = array.length
  if (count <= 0 || n === 0) return []
  if (count >= n) return shuffleArray(array)

  const result: T[] = []
  const pickedIndices = new Set<number>()
  while (pickedIndices.size < count) {
    const idx = Math.floor(Math.random() * n)
    if (!pickedIndices.has(idx)) {
      pickedIndices.add(idx)
      result.push(array[idx])
    }
  }
  return result
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

