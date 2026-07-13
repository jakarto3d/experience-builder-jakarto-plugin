import {
  buildObserverIconSvg,
  buildObserverIconDataUrl,
  OBSERVER_ICON_SIZE,
  DEFAULT_OBSERVER_FOV,
  jakartownsPanToMarkerAngle,
  roundObserverFov
} from './observerIcon'

function extractMainArcDashArray(svg: string): [number, number] {
  const match = svg.match(/url\(#arc\)"[^>]*stroke-dasharray="([\d.]+) ([\d.]+)"/)
  if (!match) throw new Error('Main arc <circle> not found in generated SVG')
  return [Number(match[1]), Number(match[2])]
}

describe('buildObserverIconSvg', () => {
  it('sizes the root <svg> from OBSERVER_ICON_SIZE', () => {
    const svg = buildObserverIconSvg(60)
    expect(svg).toContain(`width="${OBSERVER_ICON_SIZE}"`)
    expect(svg).toContain(`height="${OBSERVER_ICON_SIZE}"`)
  })

  it('produces a zero-length arc at fov=0', () => {
    const [arcLength] = extractMainArcDashArray(buildObserverIconSvg(0))
    expect(arcLength).toBeCloseTo(0)
  })

  it('produces a full circle (no gap) at fov=360', () => {
    const [, gapLength] = extractMainArcDashArray(buildObserverIconSvg(360))
    expect(gapLength).toBeCloseTo(0)
  })

  it('produces half the circumference at fov=180', () => {
    const circumference = 2 * Math.PI * 14
    const [arcLength] = extractMainArcDashArray(buildObserverIconSvg(180))
    expect(arcLength).toBeCloseTo(circumference / 2)
  })

  it('clamps a negative fov to the same output as fov=0', () => {
    expect(buildObserverIconSvg(-50)).toBe(buildObserverIconSvg(0))
  })

  it('clamps a fov above 360 to the same output as fov=360', () => {
    expect(buildObserverIconSvg(500)).toBe(buildObserverIconSvg(360))
  })
})

describe('buildObserverIconDataUrl', () => {
  it('wraps the SVG as an encoded data URL', () => {
    const svg = buildObserverIconSvg(60)
    expect(buildObserverIconDataUrl(60)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  })
})

describe('jakartownsPanToMarkerAngle', () => {
  it('maps pan=0 (North) to angle 0', () => {
    expect(jakartownsPanToMarkerAngle(0)).toBe(0)
  })

  it('maps a positive (counter-clockwise) pan to a decreasing clockwise angle', () => {
    expect(jakartownsPanToMarkerAngle(Math.PI / 2)).toBeCloseTo(270)
  })

  it('maps pan=PI (South) to angle 180 either direction', () => {
    expect(jakartownsPanToMarkerAngle(Math.PI)).toBeCloseTo(180)
  })

  it('wraps a negative pan into [0, 360)', () => {
    expect(jakartownsPanToMarkerAngle(-Math.PI / 2)).toBeCloseTo(90)
  })

  it('wraps a full turn (2*PI) back to 0', () => {
    expect(jakartownsPanToMarkerAngle(2 * Math.PI)).toBeCloseTo(0)
  })
})

describe('roundObserverFov', () => {
  it('falls back to DEFAULT_OBSERVER_FOV when fov is null', () => {
    expect(roundObserverFov(null, 2)).toBe(DEFAULT_OBSERVER_FOV)
  })

  it('rounds down to the nearest half-degree at precision 2', () => {
    expect(roundObserverFov(59.24, 2)).toBe(59)
  })

  it('rounds up to the nearest half-degree at precision 2', () => {
    expect(roundObserverFov(59.26, 2)).toBe(59.5)
  })
})
