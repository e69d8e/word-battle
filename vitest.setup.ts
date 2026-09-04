import "@testing-library/jest-dom/vitest"

// Mock Web Audio API for jsdom
class MockAudioNode {
  connect() {
    return this
  }
  disconnect() {}
}

class MockAudioParam {
  value = 0
  setValueAtTime() {
    return this
  }
  exponentialRampToValueAtTime() {
    return this
  }
  linearRampToValueAtTime() {
    return this
  }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam()
}

class MockOscillatorNode extends MockAudioNode {
  type = "sine"
  frequency = new MockAudioParam()
  start() {}
  stop() {}
}

class MockAudioContext {
  currentTime = 0
  state: "running" | "suspended" | "closed" = "running"
  destination = new MockAudioNode()

  createOscillator() {
    return new MockOscillatorNode()
  }

  createGain() {
    return new MockGainNode()
  }

  async resume() {
    this.state = "running"
  }

  async close() {
    this.state = "closed"
  }
}

// Attach to window and global
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).AudioContext = MockAudioContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).webkitAudioContext = MockAudioContext

  // Mock HTMLAudioElement
  class MockAudio {
    src = ""
    currentTime = 0
    pause() {}
    async play() {
      return Promise.resolve()
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).Audio = MockAudio
}

// Mock localStorage if needed
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>()
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
  })
}
