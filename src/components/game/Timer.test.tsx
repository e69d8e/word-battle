import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Timer } from "./Timer"

describe("Timer component", () => {
  it("renders countdown seconds and normal clock icon", () => {
    render(<Timer seconds={12} total={15} />)

    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("s")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "clock" })).toHaveTextContent("⏱️")
  })

  it("calculates progress bar width accurately", () => {
    const { container } = render(<Timer seconds={10} total={20} />)
    const progressBar = container.querySelector("[style*='width']")

    expect(progressBar).not.toBeNull()
    expect(progressBar?.getAttribute("style")).toContain("width: 50%")
  })

  it("applies urgent styling and hourglass icon when seconds <= 5", () => {
    render(<Timer seconds={4} total={15} />)

    expect(screen.getByRole("img", { name: "clock" })).toHaveTextContent("⏳")
    const numberSpan = screen.getByText("4")
    expect(numberSpan.className).toContain("text-error")
  })

  it("applies warning style when 5 < seconds <= 8", () => {
    const { container } = render(<Timer seconds={7} total={15} />)

    expect(screen.getByRole("img", { name: "clock" })).toHaveTextContent("⏱️")
    const progressBar = container.querySelector("[style*='width']")
    expect(progressBar?.className).toContain("from-accent-amber")
  })
})
