import {
  getStoredApiKey,
  authenticate,
  logout,
  getStoredSettings,
  storeSettings,
  initializeViewer,
  buildJakartownsUrl
} from './jakarto'

// Private storage keys in jakarto.ts (not exported) — duplicated here from
// the current source. If these tests ever pass vacuously (writing under the
// wrong key would make a "corrupt JSON" test a no-op instead of exercising
// the fallback), check these against services/jakarto.ts first.
const API_KEY_STORAGE_KEY = 'jakartowns-viewer:apiKey'
const SETTINGS_STORAGE_KEY = 'jakartowns-viewer:settings'
const JAKARTOWNS_SCRIPT_URL = 'https://maps.jakarto.com/api/v1.js'

function mockFetchOnce(response: Partial<Response>): void {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce(response as Response)
}

function createMockJakartownsApi() {
  const viewer = {
    setPosition: jest.fn(),
    setTilt: jest.fn(),
    setPan: jest.fn(),
    setFov: jest.fn(),
    setImage: jest.fn(),
    setMarkers: jest.fn()
  }
  const createJakartowns = jest.fn((_selector: string, _options: Record<string, unknown>, callback: (v: typeof viewer) => void) => {
    callback(viewer)
  })
  return { viewer, createJakartowns, api: { app: { create_jakartowns: createJakartowns } } }
}

beforeEach(() => {
  localStorage.clear()
  delete (window as any).jakartowns
  document.querySelectorAll('script').forEach((el) => el.remove())
  global.fetch = jest.fn() as unknown as typeof fetch
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('buildJakartownsUrl', () => {
  const position = { latitude: 45.5, longitude: -73.6 }

  it('uses lat/lng when no uid is given', () => {
    const url = buildJakartownsUrl(position)
    expect(url).toContain('lat=45.5')
    expect(url).toContain('lng=-73.6')
    expect(url).not.toContain('uid=')
  })

  it('prioritizes uid over lat/lng when both could apply', () => {
    const url = buildJakartownsUrl(position, { uid: 'img-42' })
    expect(url).toContain('uid=img-42')
    expect(url).not.toContain('lat=')
    expect(url).not.toContain('lng=')
  })

  it('includes pan/tilt/fov/year only when provided', () => {
    const url = buildJakartownsUrl(position, { pan: 1.5, tilt: -0.2, fov: 75, year: 2022 })
    expect(url).toContain('pan=1.5')
    expect(url).toContain('tilt=-0.2')
    expect(url).toContain('fov=75')
    expect(url).toContain('year=2022')
  })

  it('omits pan/tilt/fov/year when null/undefined', () => {
    const url = buildJakartownsUrl(position, {})
    expect(url).not.toMatch(/[?&](pan|tilt|fov|year)=/)
  })
})

describe('getStoredSettings / storeSettings', () => {
  it('returns the default settings when nothing is stored', () => {
    expect(getStoredSettings()).toEqual({ rightClickToLocate: false })
  })

  it('round-trips a stored setting', () => {
    storeSettings({ rightClickToLocate: true })
    expect(getStoredSettings()).toEqual({ rightClickToLocate: true })
  })

  it('falls back to defaults when the stored JSON is corrupt', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not valid json')
    expect(getStoredSettings()).toEqual({ rightClickToLocate: false })
  })
})

describe('getStoredApiKey', () => {
  it('returns null when nothing is stored', () => {
    expect(getStoredApiKey()).toBeNull()
  })

  it('returns the key stored by a successful authenticate()', async () => {
    mockFetchOnce({ ok: true })
    await authenticate('my-api-key')
    expect(getStoredApiKey()).toBe('my-api-key')
  })
})

describe('authenticate', () => {
  it('returns true and caches the key on a successful response', async () => {
    mockFetchOnce({ ok: true })
    await expect(authenticate('good-key')).resolves.toBe(true)
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('good-key')
  })

  it('returns false and does not cache the key on a failed response', async () => {
    mockFetchOnce({ ok: false })
    await expect(authenticate('bad-key')).resolves.toBe(false)
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull()
  })

  it('returns false when fetch throws (network error)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))
    await expect(authenticate('any-key')).resolves.toBe(false)
  })
})

describe('logout', () => {
  it('clears the cached key even if the request fails', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'stale-key')
    mockFetchOnce({ ok: false })
    await logout()
    expect(getStoredApiKey()).toBeNull()
  })

  it('returns true on a successful response', async () => {
    mockFetchOnce({ ok: true })
    await expect(logout()).resolves.toBe(true)
  })

  it('returns false when fetch throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))
    await expect(logout()).resolves.toBe(false)
  })
})

describe('initializeViewer — script loading', () => {
  it('injects the Jakartowns script and waits for it to load before creating the viewer', async () => {
    const { api, createJakartowns } = createMockJakartownsApi()
    const container = document.createElement('div')

    const handlePromise = initializeViewer(container)

    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${JAKARTOWNS_SCRIPT_URL}"]`)
    expect(script).not.toBeNull()
    expect(createJakartowns).not.toHaveBeenCalled()

    // Simulates what the real external script does on load: expose window.jakartowns.
    ;(window as any).jakartowns = api
    script?.onload?.(new Event('load'))

    const handle = await handlePromise
    expect(handle).not.toBeNull()
    expect(createJakartowns).toHaveBeenCalledTimes(1)
  })

  it('rejects if the script fails to load', async () => {
    const container = document.createElement('div')
    const handlePromise = initializeViewer(container)
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${JAKARTOWNS_SCRIPT_URL}"]`)
    script?.onerror?.(new Event('error'))
    await expect(handlePromise).rejects.toThrow('Échec du chargement du script Jakartowns')
  })

  it('resolves null if the API is unavailable after the script loads', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    const handlePromise = initializeViewer(container)
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${JAKARTOWNS_SCRIPT_URL}"]`)
    ;(window as any).jakartowns = {}
    script?.onload?.(new Event('load'))
    await expect(handlePromise).resolves.toBeNull()
  })

  it('skips script injection entirely when window.jakartowns is already set', async () => {
    const { api } = createMockJakartownsApi()
    ;(window as any).jakartowns = api
    const container = document.createElement('div')
    await initializeViewer(container)
    expect(document.head.querySelector(`script[src="${JAKARTOWNS_SCRIPT_URL}"]`)).toBeNull()
  })
})

describe('initializeViewer — viewer wiring', () => {
  function setUp(options: Parameters<typeof initializeViewer>[1] = {}) {
    const { api, viewer, createJakartowns } = createMockJakartownsApi()
    ;(window as any).jakartowns = api
    const container = document.createElement('div')
    return { container, viewer, createJakartowns, handlePromise: initializeViewer(container, options) }
  }

  it('assigns the container an id and calls create_jakartowns with a matching selector', async () => {
    const { container, createJakartowns, handlePromise } = setUp()
    await handlePromise
    expect(container.id).toMatch(/^jakartowns-viewer-/)
    expect(createJakartowns.mock.calls[0][0]).toBe(`#${container.id}`)
  })

  it('enables the compass by default', async () => {
    const { createJakartowns, handlePromise } = setUp()
    await handlePromise
    expect(createJakartowns.mock.calls[0][1]).toEqual(expect.objectContaining({ compassEnabled: true }))
  })

  it('disables the compass when compassEnabled is false', async () => {
    const { createJakartowns, handlePromise } = setUp({ compassEnabled: false })
    await handlePromise
    expect(createJakartowns.mock.calls[0][1]).toEqual(expect.objectContaining({ compassEnabled: false }))
  })

  it('parses a position event into onViewChange, including multipass images', async () => {
    const onViewChange = jest.fn()
    const { handlePromise } = setUp({ onViewChange })
    await handlePromise

    window.dispatchEvent(new CustomEvent('position', {
      detail: {
        latitude: 45.5,
        longitude: -73.6,
        currentSphereInfo: { properties: { image_id: 'img-42', date: '2021-05-01' } },
        multipassAtLocation: [
          { properties: { image_id: 'img-42', date: '2021-05-01' } },
          { properties: { image_id: 'img-43', date: '2022-01-01' } }
        ]
      }
    }))

    expect(onViewChange).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 45.5,
      longitude: -73.6,
      imageId: 'img-42',
      date: '2021-05-01',
      availableImages: [
        { imageId: 'img-42', date: '2021-05-01' },
        { imageId: 'img-43', date: '2022-01-01' }
      ]
    }))
  })

  it('defaults imageId/date to null when currentSphereInfo is absent', async () => {
    const onViewChange = jest.fn()
    const { handlePromise } = setUp({ onViewChange })
    await handlePromise

    window.dispatchEvent(new CustomEvent('position', { detail: { latitude: 1, longitude: 2 } }))

    expect(onViewChange).toHaveBeenCalledWith(expect.objectContaining({
      imageId: null,
      date: null,
      availableImages: []
    }))
  })

  it('fires onOrientationChange on rotation with the fov known so far (null until a fov event arrives)', async () => {
    const onOrientationChange = jest.fn()
    const { handlePromise } = setUp({ onOrientationChange })
    await handlePromise

    window.dispatchEvent(new CustomEvent('rotation', { detail: Math.PI / 2 }))
    expect(onOrientationChange).toHaveBeenLastCalledWith(Math.PI / 2, null)

    window.dispatchEvent(new CustomEvent('fov', { detail: 75 }))
    expect(onOrientationChange).toHaveBeenLastCalledWith(Math.PI / 2, 75)
  })

  it('tracks tilt in getViewState() even though it has no dedicated change callback', async () => {
    const { handlePromise } = setUp()
    const handle = await handlePromise

    window.dispatchEvent(new CustomEvent('tilt', { detail: 0.2 }))

    expect(handle?.getViewState().tilt).toBe(0.2)
  })

  it('defers the initial setPosition call to a later animation frame', async () => {
    jest.useFakeTimers()
    const { viewer, handlePromise } = setUp({ latitude: 1, longitude: 2 })
    await handlePromise

    expect(viewer.setPosition).not.toHaveBeenCalled()
    jest.runAllTimers()
    expect(viewer.setPosition).toHaveBeenCalledWith({ latitude: 1, longitude: 2 })
  })

  it('does not call the viewer setPosition on mount when no initial coordinates are given', async () => {
    jest.useFakeTimers()
    const { viewer, handlePromise } = setUp()
    await handlePromise
    jest.runAllTimers()
    expect(viewer.setPosition).not.toHaveBeenCalled()
  })

  it('nudges Jakartowns to resize its canvas via a deferred window resize event', async () => {
    jest.useFakeTimers()
    const resizeSpy = jest.fn()
    window.addEventListener('resize', resizeSpy)
    const { handlePromise } = setUp()
    await handlePromise

    expect(resizeSpy).not.toHaveBeenCalled()
    jest.runAllTimers()
    expect(resizeSpy).toHaveBeenCalledTimes(1)
    window.removeEventListener('resize', resizeSpy)
  })

  it('handle.setPosition coerces numeric-looking strings but rejects non-numeric input', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { viewer, handlePromise } = setUp()
    const handle = await handlePromise

    handle?.setPosition({ latitude: 'not-a-number' as any, longitude: -73.6 })
    expect(viewer.setPosition).not.toHaveBeenCalled()

    handle?.setPosition({ latitude: '45.5' as any, longitude: '-73.6' as any })
    expect(viewer.setPosition).toHaveBeenCalledWith({ latitude: 45.5, longitude: -73.6 })
  })

  it('handle.setImage delegates directly to the underlying viewer', async () => {
    const { viewer, handlePromise } = setUp()
    const handle = await handlePromise
    handle?.setImage('img-99')
    expect(viewer.setImage).toHaveBeenCalledWith('img-99')
  })

  it('handle.destroy() stops reacting to further window events and further calls', async () => {
    const onViewChange = jest.fn()
    const { viewer, handlePromise } = setUp({ onViewChange })
    const handle = await handlePromise

    handle?.destroy()
    window.dispatchEvent(new CustomEvent('position', { detail: { latitude: 1, longitude: 2 } }))
    expect(onViewChange).not.toHaveBeenCalled()

    handle?.setPosition({ latitude: 1, longitude: 2 })
    expect(viewer.setPosition).not.toHaveBeenCalled()
  })
})
