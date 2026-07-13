/**
 * services/jakarto.ts
 *
 * Isolates all Jakartowns integration (auth + viewer embed) from the rest
 * of the React widget, on the same principle as
 * `esri_js_sdk_demo/services/jakarto.js` (the reference Vue prototype).
 *
 * Deliberate difference from the prototype: here the viewer state
 * (`JakartoViewerHandle`) is returned per instance instead of kept in
 * module-level variables — an Experience Builder page can contain several
 * instances of the same widget, so module-scoped state would be shared
 * (and would break) between them.
 *
 * Authentication flow (see docs/research-jakartowns-api.md):
 *   1. The user provides their Jakarto API key.
 *   2. It's exchanged for a session cookie via account.jakarto.com.
 *   3. The script https://maps.jakarto.com/api/v1.js is loaded (authorized
 *      by the session cookie).
 *   4. The viewer is created via window.jakartowns.app.create_jakartowns(...).
 *
 * The API key is also cached in localStorage (see `getStoredApiKey` /
 * `storeApiKey`): `checkAuthStatus` (the older way to detect an already
 * active session) is blocked by CORS on `account.jakarto.com/auth` from
 * most embedding origins, so it can't be relied on to avoid re-asking for
 * the key on every reload.
 */

const JAKARTO_LOGIN_URL = 'https://account.jakarto.com/users/trade-api-key'
const JAKARTO_LOGOUT_URL = 'https://account.jakarto.com/users/logout'
const JAKARTOWNS_SCRIPT_URL = 'https://maps.jakarto.com/api/v1.js'
const JAKARTOWNS_APP_URL = 'https://maps.jakarto.com/'
const API_KEY_STORAGE_KEY = 'jakartowns-viewer:apiKey'
const SETTINGS_STORAGE_KEY = 'jakartowns-viewer:settings'
// Upper bound of the random suffix generated for the viewer container's id (see initializeViewer).
const CONTAINER_ID_RANDOM_SUFFIX_MAX = 1e6

export interface JakartoPosition {
  latitude: number
  longitude: number
}

export interface JakartoMultipassImage {
  imageId: string
  date: string | null
}

/** Snapshot of what the viewer currently displays. */
export interface JakartoViewState {
  latitude: number | null
  longitude: number | null
  imageId: string | null
  date: string | null
  pan: number | null
  tilt: number | null
  fov: number | null
  availableImages: JakartoMultipassImage[]
}

interface JakartownsViewer {
  setPosition: (position: JakartoPosition, options?: Record<string, unknown>) => void
  setTilt: (value: number) => void
  setPan: (value: number) => void
  setFov: (value: number) => void
  setImage: (uid: string) => void
  setMarkers: (geojson: unknown) => void
}

/**
 * The viewer does NOT expose an `.on(...)` method: it dispatches its
 * navigation events on `window`, as `CustomEvent`s. Confirmed by reading
 * the actual code of a production Jakarto app, which listens exactly this
 * way. Note: these events are global, not scoped per instance — two
 * Jakartowns widgets on the same page would receive each other's events
 * (a library limitation, not something on our side).
 */
interface JakartownsPositionEventDetail {
  latitude: number
  longitude: number
  currentSphereInfo?: {
    properties?: {
      image_id?: string
      date?: string
    }
  }
  multipassAtLocation?: Array<{
    properties: {
      image_id: string
      date?: string
    }
  }>
}

interface JakartownsApi {
  app: {
    create_jakartowns: (
      selector: string,
      options: Record<string, unknown>,
      callback: (viewer: JakartownsViewer) => void
    ) => void
  }
}

declare global {
  interface Window {
    jakartowns?: JakartownsApi
  }
}

/**
 * localStorage can throw (strict private browsing, sandboxed iframe…):
 * these three wrappers isolate the try/catch — not blocking for the
 * caller, just less convenient for the user (key/settings re-asked).
 */
function readLocalStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorageItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignored, see comment above.
  }
}

function removeLocalStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignored, see comment above.
  }
}

/**
 * Retrieves the Jakarto API key cached locally, if the user has already
 * successfully logged in on this browser.
 */
export function getStoredApiKey(): string | null {
  return readLocalStorageItem(API_KEY_STORAGE_KEY)
}

function storeApiKey(apiKey: string): void {
  writeLocalStorageItem(API_KEY_STORAGE_KEY, apiKey)
}

function clearStoredApiKey(): void {
  removeLocalStorageItem(API_KEY_STORAGE_KEY)
}

/** Widget settings the user can explicitly enable (see settings panel). */
export interface JakartoWidgetSettings {
  /**
   * Right-clicking the map can conflict with a default behavior of the
   * host application — disabled until the user explicitly enables it.
   */
  rightClickToLocate: boolean
}

const DEFAULT_SETTINGS: JakartoWidgetSettings = {
  rightClickToLocate: false
}

/** Loads widget settings from localStorage (falls back to defaults). */
export function getStoredSettings(): JakartoWidgetSettings {
  const raw = readLocalStorageItem(SETTINGS_STORAGE_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // Corrupted JSON: fall back to defaults instead of crashing.
    return { ...DEFAULT_SETTINGS }
  }
}

export function storeSettings(settings: JakartoWidgetSettings): void {
  writeLocalStorageItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

/**
 * Exchanges a Jakarto API key for a session cookie, and caches it locally
 * on success to avoid re-asking for it on the widget's next load.
 */
export async function authenticate(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(JAKARTO_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ apiKey })
    })
    if (response.ok) {
      storeApiKey(apiKey)
    }
    return response.ok
  } catch (error) {
    console.error('[Jakarto] Authentification échouée :', error)
    return false
  }
}

/**
 * Invalidates the current Jakarto session cookie and forgets the cached key.
 */
export async function logout(): Promise<boolean> {
  clearStoredApiKey()
  try {
    const response = await fetch(JAKARTO_LOGOUT_URL, {
      method: 'POST',
      credentials: 'include',
      mode: 'cors'
    })
    return response.ok
  } catch (error) {
    console.error('[Jakarto] Déconnexion échouée :', error)
    return false
  }
}

function loadJakartownsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.jakartowns) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = JAKARTOWNS_SCRIPT_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Échec du chargement du script Jakartowns'))
    document.head.appendChild(script)
  })
}

export interface InitializeViewerOptions {
  latitude?: number
  longitude?: number
  /** Whether Jakartowns shows its own compass for orienting inside the panorama. Defaults to `true`. */
  compassEnabled?: boolean
  /** Called on every position/image change (`position` event). */
  onViewChange?: (state: JakartoViewState) => void
  /**
   * Called on every rotation or field-of-view change (can fire frequently
   * during a drag/zoom inside the panorama) — separate from `onViewChange`
   * to allow updating an orientation indicator without triggering a React
   * re-render on every tick. `pan` can be `null` if no `rotation` event has
   * arrived yet.
   */
  onOrientationChange?: (pan: number | null, fov: number | null) => void
}

export interface JakartoViewerHandle {
  /** Moves the panorama view — used for map → Jakartowns synchronization. */
  setPosition: (position: JakartoPosition) => void
  /**
   * Sets the horizontal rotation (0 = North, π/2 = West — see
   * buildJakartownsUrl below). Used to override the pan the Jakartowns API
   * auto-rotates to after a setPosition call — see lib/bearing.ts.
   */
  setPan: (panRadians: number) => void
  /** Displays a specific image among those available at the same spot (multipass). */
  setImage: (imageId: string) => void
  /** Synchronous snapshot of the current state (position, image, orientation) — used when clicking "Open in Jakartowns". */
  getViewState: () => JakartoViewState
  /** Stops propagating the viewer's events (call on widget unmount). */
  destroy: () => void
}

/**
 * Initializes the Jakartowns viewer inside a DOM container.
 * Must only be called after a successful authentication.
 *
 * @returns `null` if the Jakartowns script/API couldn't be loaded.
 */
export async function initializeViewer(
  container: HTMLElement,
  options: InitializeViewerOptions = {}
): Promise<JakartoViewerHandle | null> {
  await loadJakartownsScript()

  const api = window.jakartowns
  if (!api?.app?.create_jakartowns) {
    console.warn('[Jakarto] API Jakartowns indisponible après chargement du script.')
    return null
  }

  // create_jakartowns takes a CSS selector: the container needs an id.
  if (!container.id) {
    container.id = `jakartowns-viewer-${Date.now()}-${Math.round(Math.random() * CONTAINER_ID_RANDOM_SUFFIX_MAX)}`
  }

  return new Promise((resolve) => {
    api.app.create_jakartowns(
      `#${container.id}`,
      {
        // Hides Jakartowns' native header (logo/search/help) — the widget
        // shows its own "Jakartowns" title bar and its ArcGIS map already
        // acts as a minimap. The compass stays useful for orienting inside
        // the panorama, so it defaults to on but can be turned off in the
        // widget's settings panel.
        headerEnabled: false,
        minimapEnabled: false,
        compassEnabled: options.compassEnabled ?? true
      },
      (viewer) => {
        let destroyed = false

        const state: JakartoViewState = {
          latitude: options.latitude ?? null,
          longitude: options.longitude ?? null,
          imageId: null,
          date: null,
          pan: null,
          tilt: null,
          fov: null,
          availableImages: []
        }

        const onPositionEvent = (event: Event) => {
          if (destroyed) return
          const detail = (event as CustomEvent<JakartownsPositionEventDetail>).detail
          state.latitude = detail.latitude
          state.longitude = detail.longitude
          state.imageId = detail.currentSphereInfo?.properties?.image_id ?? null
          state.date = detail.currentSphereInfo?.properties?.date ?? null
          state.availableImages = (detail.multipassAtLocation ?? []).map((entry) => ({
            imageId: entry.properties.image_id,
            date: entry.properties.date ?? null
          }))
          options.onViewChange?.({ ...state })
        }
        window.addEventListener('position', onPositionEvent)

        // pan/tilt/fov are only useful when building the "Open in
        // Jakartowns" URL (via getViewState()): kept internal without
        // triggering a React callback on every micro-rotation, except for
        // onOrientationChange (dedicated, lightweight) for the map indicator.
        const onRotationEvent = (event: Event) => {
          if (destroyed) return
          const pan = (event as CustomEvent<number>).detail
          state.pan = pan
          options.onOrientationChange?.(pan, state.fov)
        }
        window.addEventListener('rotation', onRotationEvent)

        const onTiltEvent = (event: Event) => {
          if (destroyed) return
          state.tilt = (event as CustomEvent<number>).detail
        }
        window.addEventListener('tilt', onTiltEvent)

        const onFovEvent = (event: Event) => {
          if (destroyed) return
          const fov = (event as CustomEvent<number>).detail
          state.fov = fov
          options.onOrientationChange?.(state.pan, fov)
        }
        window.addEventListener('fov', onFovEvent)

        if (options.latitude != null && options.longitude != null) {
          // Deferred to a later frame (like the resize dispatch below): if
          // called strictly synchronously here, this first setPosition
          // sometimes seems to run before Jakartowns finishes its internal
          // initialization, and the following `position` event then arrives
          // without `currentSphereInfo` — the date and image timeline stay
          // empty on the very first load (observed by the user). Not 100%
          // confirmed, but cheap to try given the similar fix already
          // validated for the canvas below.
          const { latitude, longitude } = options
          requestAnimationFrame(() => {
            if (destroyed) return
            viewer.setPosition({ latitude, longitude })
          })
        }

        // Jakartowns only resizes its canvas in reaction to `window`'s
        // `resize` event (no ResizeObserver on its own container) —
        // confirmed by observing that another internal Jakarto viewer app
        // forces a `window.dispatchEvent(new Event('resize'))` on every size
        // change of its panel containing the viewer. A container mounted by React
        // never triggers a real window resize: without this nudge, the
        // canvas stays stuck at its creation size (often 0x0).
        const dispatchResize = () => window.dispatchEvent(new Event('resize'))
        requestAnimationFrame(dispatchResize)

        const resizeObserver = new ResizeObserver(() => dispatchResize())
        resizeObserver.observe(container)

        resolve({
          setPosition: (position) => {
            if (destroyed) return
            const lat = Number(position.latitude)
            const lng = Number(position.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              console.warn('[Jakarto] Coordonnées invalides passées à setPosition :', position)
              return
            }
            viewer.setPosition({ latitude: lat, longitude: lng })
          },
          setPan: (panRadians) => {
            if (destroyed) return
            viewer.setPan(panRadians)
          },
          setImage: (imageId) => {
            if (destroyed) return
            viewer.setImage(imageId)
          },
          getViewState: () => ({ ...state }),
          destroy: () => {
            destroyed = true
            resizeObserver.disconnect()
            window.removeEventListener('position', onPositionEvent)
            window.removeEventListener('rotation', onRotationEvent)
            window.removeEventListener('tilt', onTiltEvent)
            window.removeEventListener('fov', onFovEvent)
          }
        })
      }
    )
  })
}

export interface JakartownsUrlOptions {
  /** Technical id of the image to open — prioritized over lat/lng when available, to point at exactly the same capture. */
  uid?: string | null
  /** Horizontal rotation (0 = North, π/2 = West, π = South). */
  pan?: number | null
  /** Vertical tilt (0 = horizontal, ±π/2 = zenith/nadir). */
  tilt?: number | null
  /** Field of view, from 10 to 100 (default 100). */
  fov?: number | null
  /** Year of the map data to display, if several are available. */
  year?: number
}

/**
 * Builds a Jakartowns URL pointing at a position or, ideally, at a
 * specific image (`uid`) — this is what a production Jakarto app does for
 * its "Open in Jakartowns" button: it prioritizes `uid` (+ pan/tilt/fov)
 * over lat/lng as soon as an image is loaded, to reopen exactly the same
 * capture rather than a nearby but different one.
 */
export function buildJakartownsUrl(position: JakartoPosition, options: JakartownsUrlOptions = {}): string {
  const params = new URLSearchParams()
  if (options.uid) {
    params.set('uid', options.uid)
  } else {
    params.set('lat', String(position.latitude))
    params.set('lng', String(position.longitude))
  }
  if (options.pan != null) params.set('pan', String(options.pan))
  if (options.tilt != null) params.set('tilt', String(options.tilt))
  if (options.fov != null) params.set('fov', String(options.fov))
  if (options.year != null) params.set('year', String(options.year))
  return `${JAKARTOWNS_APP_URL}?${params.toString()}`
}
