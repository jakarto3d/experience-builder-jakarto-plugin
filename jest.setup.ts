// Fixed timezone so Intl.DateTimeFormat-based tests (e.g. formatJakartoDate)
// are deterministic regardless of the machine/CI running them.
process.env.TZ = 'UTC'

/**
 * jsdom doesn't reliably provide requestAnimationFrame/ResizeObserver across
 * versions, and services/jakarto.ts's initializeViewer relies on both.
 * Polyfilled on setTimeout so `jest.useFakeTimers()` + `jest.runAllTimers()`
 * can flush them deterministically instead of relying on real waits.
 */
if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return (setTimeout(() => callback(Date.now()), 0) as unknown) as number
  }
}

if (typeof window.ResizeObserver !== 'function') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
