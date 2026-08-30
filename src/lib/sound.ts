// Web Audio API Sound Effects Engine (Zero external dependencies)
"use client"

class SoundManager {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("word_battle_sound_enabled")
      this.enabled = saved !== null ? saved === "true" : true
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (typeof window !== "undefined") {
      localStorage.setItem("word_battle_sound_enabled", String(enabled))
      window.dispatchEvent(new CustomEvent("word_battle_sound_toggle", { detail: { enabled } }))
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public playClick() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime

    osc.type = "sine"
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
  }

  public playCorrect() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // First note (E5 = 659.25Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "triangle"
    osc1.frequency.setValueAtTime(659.25, now)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.13)

    // Second note (B5 = 987.77Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "triangle"
    osc2.frequency.setValueAtTime(987.77, now + 0.08)
    gain2.gain.setValueAtTime(0.18, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.3)
  }

  public playWrong() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22)

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.23)
  }

  public playCombo(comboCount: number) {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Scale pitch based on combo streak
    const baseFreq = 523.25 * Math.min(1.8, 1 + (comboCount - 1) * 0.12)

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = "sine"
    osc1.frequency.setValueAtTime(baseFreq, now)
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.18)

    osc2.type = "triangle"
    osc2.frequency.setValueAtTime(baseFreq * 1.25, now + 0.05)
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.25)

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.2)
    osc2.start(now + 0.05)
    osc2.stop(now + 0.26)
  }

  public playCountdownTick(isFinal: boolean = false) {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now)

    gain.gain.setValueAtTime(isFinal ? 0.25 : 0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.25 : 0.08))

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + (isFinal ? 0.26 : 0.09))
  }

  public playGameStart() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.16, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.22)
    })
  }

  public playVictory() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.1
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "triangle"
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.36)
    })
  }

  public playDefeat() {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const notes = [440, 415.3, 392, 349.23] // A4, Ab4, G4, F4
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.15
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.26)
    })
  }
}

export const sound = new SoundManager()
