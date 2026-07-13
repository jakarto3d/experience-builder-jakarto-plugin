import { buildTimelineEntries } from './timeline'

describe('buildTimelineEntries', () => {
  it('returns an empty list when there is no image at all', () => {
    expect(buildTimelineEntries([], null, null)).toEqual([])
  })

  it('falls back to a single entry built from the current image/date when there is no multipass', () => {
    expect(buildTimelineEntries([], 'img-1', '2026-07-13')).toEqual([
      { imageId: 'img-1', date: '2026-07-13' }
    ])
  })

  it('falls back to a single entry with a null date if the current date is unknown', () => {
    expect(buildTimelineEntries([], 'img-1', null)).toEqual([{ imageId: 'img-1', date: null }])
  })

  it('returns the multipass list as-is when available, ignoring the single-image fallback', () => {
    const availableImages = [
      { imageId: 'img-1', date: '2020-01-01' },
      { imageId: 'img-2', date: '2022-06-15' }
    ]
    expect(buildTimelineEntries(availableImages, 'img-2', '2022-06-15')).toBe(availableImages)
  })
})
