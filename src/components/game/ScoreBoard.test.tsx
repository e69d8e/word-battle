import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScoreBoard } from "./ScoreBoard"

describe("ScoreBoard component", () => {
  const basePlayer1 = {
    name: "Alice",
    score: 300,
    correctCount: 2,
    combo: 2,
    lastScoreGained: 150,
    isMe: true,
  }

  const basePlayer2 = {
    name: "Bob",
    score: 150,
    correctCount: 1,
    combo: 0,
    lastScoreGained: 0,
    isMe: false,
  }

  it("renders both players' names, scores, and round progress", () => {
    render(
      <ScoreBoard
        player1={basePlayer1}
        player2={basePlayer2}
        currentQuestion={3}
        totalQuestions={10}
      />
    )

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("300")).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText("第 3/10 题")).toBeInTheDocument()
    expect(screen.getByText("VS")).toBeInTheDocument()
  })

  it("displays leading indicator for player with higher score", () => {
    render(
      <ScoreBoard
        player1={{ ...basePlayer1, score: 500, combo: 0 }}
        player2={{ ...basePlayer2, score: 200 }}
        currentQuestion={4}
        totalQuestions={10}
      />
    )

    expect(screen.getByText("👑 领先")).toBeInTheDocument()
  })

  it("displays combo streak badge when combo >= 2", () => {
    render(
      <ScoreBoard
        player1={{ ...basePlayer1, combo: 3 }}
        player2={basePlayer2}
        currentQuestion={4}
        totalQuestions={10}
      />
    )

    expect(screen.getByText("3 连击")).toBeInTheDocument()
  })

  it("displays floating score indicator when lastScoreGained > 0", () => {
    render(
      <ScoreBoard
        player1={{ ...basePlayer1, lastScoreGained: 180 }}
        player2={basePlayer2}
        currentQuestion={2}
        totalQuestions={10}
      />
    )

    expect(screen.getByText("+180")).toBeInTheDocument()
  })
})
