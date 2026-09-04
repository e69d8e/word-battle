import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QuestionCard } from "./QuestionCard"
import type { Question } from "@/types"

const mockQuestion: Question = {
  id: "q-test-1",
  word: {
    id: "w-1",
    word: "resilient",
    phonetic: "/rɪˈzɪliənt/",
    meaning: "able to withstand or recover quickly",
    meaningCn: "有韧性的；能迅速恢复的",
    example: "Babies are generally remarkably resilient.",
  },
  type: "en2cn",
  options: [
    "有韧性的；能迅速恢复的",
    "犹豫不决的；摇摆不定的",
    "极其脆弱的；易碎的",
    "粗心大意的；鲁莽的",
  ],
  correctAnswer: "有韧性的；能迅速恢复的",
}

describe("QuestionCard component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the question prompt, type badge, and all 4 options", () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    )

    expect(screen.getByText("resilient")).toBeInTheDocument()
    expect(screen.getByText("/rɪˈzɪliənt/")).toBeInTheDocument()
    expect(screen.getByText("QUESTION 1/10")).toBeInTheDocument()
    expect(screen.getByText("英译中")).toBeInTheDocument()

    expect(screen.getByText("有韧性的；能迅速恢复的")).toBeInTheDocument()
    expect(screen.getByText("犹豫不决的；摇摆不定的")).toBeInTheDocument()
    expect(screen.getByText("极其脆弱的；易碎的")).toBeInTheDocument()
    expect(screen.getByText("粗心大意的；鲁莽的")).toBeInTheDocument()
  })

  it("handles mouse click on an option and invokes onAnswer", () => {
    const handleAnswer = vi.fn()
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={handleAnswer}
      />
    )

    const correctButton = screen.getByText("有韧性的；能迅速恢复的").closest("button")
    expect(correctButton).not.toBeNull()
    fireEvent.click(correctButton!)

    expect(handleAnswer).toHaveBeenCalledTimes(1)
    expect(handleAnswer).toHaveBeenCalledWith("有韧性的；能迅速恢复的", expect.any(Number))

    // Explanation should now be visible
    expect(screen.getByText("🎉 回答正确！")).toBeInTheDocument()
    expect(screen.getByText(/Babies are generally remarkably resilient/)).toBeInTheDocument()
  })

  it("handles keyboard shortcut A to select the first option", () => {
    const handleAnswer = vi.fn()
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={handleAnswer}
      />
    )

    fireEvent.keyDown(window, { key: "a" })

    expect(handleAnswer).toHaveBeenCalledTimes(1)
    expect(handleAnswer).toHaveBeenCalledWith("有韧性的；能迅速恢复的", expect.any(Number))
  })

  it("handles keyboard shortcut 2 to select the second option", () => {
    const handleAnswer = vi.fn()
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={handleAnswer}
      />
    )

    fireEvent.keyDown(window, { key: "2" })

    expect(handleAnswer).toHaveBeenCalledTimes(1)
    expect(handleAnswer).toHaveBeenCalledWith("犹豫不决的；摇摆不定的", expect.any(Number))
    expect(screen.getByText("⚠️ 回答错误")).toBeInTheDocument()
  })

  it("does not allow multiple answers once an option is selected", () => {
    const handleAnswer = vi.fn()
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={handleAnswer}
      />
    )

    fireEvent.keyDown(window, { key: "1" })
    fireEvent.keyDown(window, { key: "2" })

    expect(handleAnswer).toHaveBeenCalledTimes(1)
  })
})
