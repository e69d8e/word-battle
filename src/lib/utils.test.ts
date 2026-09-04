import { describe, it, expect } from "vitest"
import { cn, shuffleArray, getRandomItems, generateId } from "./utils"

describe("utils", () => {
  describe("cn", () => {
    it("merges class names correctly", () => {
      expect(cn("px-2", "py-1")).toBe("px-2 py-1")
    })

    it("handles conditional classes", () => {
      const isTrue = true
      const isFalse = false
      expect(cn("base", isTrue && "active", isFalse && "inactive")).toBe("base active")
    })

    it("resolves Tailwind conflicts using tailwind-merge", () => {
      expect(cn("px-2 text-red-500", "px-4 text-blue-500")).toBe("px-4 text-blue-500")
    })
  })

  describe("shuffleArray", () => {
    it("returns a new array with the same elements", () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = shuffleArray(original)

      expect(shuffled).toHaveLength(original.length)
      expect(shuffled.sort()).toEqual([...original].sort())
      // Does not mutate the original array
      expect(original).toEqual([1, 2, 3, 4, 5])
    })

    it("handles empty and single-element arrays", () => {
      expect(shuffleArray([])).toEqual([])
      expect(shuffleArray([42])).toEqual([42])
    })
  })

  describe("getRandomItems", () => {
    it("returns empty array when count <= 0 or input array is empty", () => {
      expect(getRandomItems([1, 2, 3], 0)).toEqual([])
      expect(getRandomItems([1, 2, 3], -2)).toEqual([])
      expect(getRandomItems([], 5)).toEqual([])
    })

    it("returns full shuffled array when count >= length", () => {
      const items = ["a", "b", "c"]
      const result = getRandomItems(items, 5)
      expect(result).toHaveLength(3)
      expect(result.sort()).toEqual(["a", "b", "c"])
    })

    it("returns requested count of unique items when count < length", () => {
      const items = [10, 20, 30, 40, 50, 60, 70, 80]
      const result = getRandomItems(items, 4)

      expect(result).toHaveLength(4)
      // All items should be unique
      expect(new Set(result).size).toBe(4)
      // All items should be from the original array
      result.forEach((item) => {
        expect(items).toContain(item)
      })
    })

    it("handles large count relative to n (partial Fisher-Yates branch)", () => {
      const items = Array.from({ length: 20 }, (_, i) => i)
      const result = getRandomItems(items, 15)

      expect(result).toHaveLength(15)
      expect(new Set(result).size).toBe(15)
      result.forEach((item) => {
        expect(items).toContain(item)
      })
    })
  })

  describe("generateId", () => {
    it("generates a valid UUID string", () => {
      const id = generateId()
      expect(typeof id).toBe("string")
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it("generates unique IDs across successive calls", () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })
  })
})
