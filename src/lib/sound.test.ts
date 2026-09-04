import { describe, it, expect, beforeEach, vi } from "vitest"
import { sound } from "./sound"

describe("SoundManager", () => {
  beforeEach(() => {
    localStorage.clear()
    sound.setEnabled(true)
  })

  it("initializes with enabled state as true by default", () => {
    expect(sound.isEnabled()).toBe(true)
  })

  it("toggles enabled state and persists to localStorage", () => {
    const nextState = sound.toggle()
    expect(nextState).toBe(false)
    expect(sound.isEnabled()).toBe(false)
    expect(localStorage.getItem("word_battle_sound_enabled")).toBe("false")

    const afterSecondToggle = sound.toggle()
    expect(afterSecondToggle).toBe(true)
    expect(sound.isEnabled()).toBe(true)
    expect(localStorage.getItem("word_battle_sound_enabled")).toBe("true")
  })

  it("dispatches word_battle_sound_toggle event on state change", () => {
    const listener = vi.fn()
    window.addEventListener("word_battle_sound_toggle", listener)

    sound.setEnabled(false)
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener("word_battle_sound_toggle", listener)
  })

  it("executes sound effects without errors when enabled", () => {
    expect(() => sound.playClick()).not.toThrow()
    expect(() => sound.playCorrect()).not.toThrow()
    expect(() => sound.playWrong()).not.toThrow()
    expect(() => sound.playCombo(3)).not.toThrow()
    expect(() => sound.playCountdownTick(false)).not.toThrow()
    expect(() => sound.playCountdownTick(true)).not.toThrow()
    expect(() => sound.playGameStart()).not.toThrow()
    expect(() => sound.playVictory()).not.toThrow()
    expect(() => sound.playDefeat()).not.toThrow()
  })

  it("silently skips playing sound effects when disabled", () => {
    sound.setEnabled(false)
    expect(() => sound.playClick()).not.toThrow()
    expect(() => sound.playCorrect()).not.toThrow()
    expect(() => sound.playWrong()).not.toThrow()
    expect(() => sound.playCombo(5)).not.toThrow()
  })
})
