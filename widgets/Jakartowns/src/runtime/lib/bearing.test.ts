import { getJakartownsPanTowards } from './bearing'

describe('getJakartownsPanTowards', () => {
  const origin = { latitude: 45, longitude: -73 }

  it('returns 0 (North) when the target is due north', () => {
    expect(getJakartownsPanTowards(origin, { latitude: 45.001, longitude: -73 })).toBeCloseTo(0)
  })

  it('returns PI/2 (West) when the target is due west', () => {
    expect(getJakartownsPanTowards(origin, { latitude: 45, longitude: -73.001 })).toBeCloseTo(Math.PI / 2)
  })

  it('returns PI (South) when the target is due south', () => {
    expect(getJakartownsPanTowards(origin, { latitude: 44.999, longitude: -73 })).toBeCloseTo(Math.PI)
  })

  it('returns 3*PI/2 (East) when the target is due east', () => {
    expect(getJakartownsPanTowards(origin, { latitude: 45, longitude: -72.999 })).toBeCloseTo((3 * Math.PI) / 2)
  })
})
