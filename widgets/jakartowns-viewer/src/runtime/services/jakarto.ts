/**
 * services/jakarto.ts
 *
 * Isole toute l'intégration Jakartowns (auth + embed du viewer) du reste du
 * widget React, sur le même principe que `esri_js_sdk_demo/services/jakarto.js`
 * (le prototype Vue de référence).
 *
 * Différence volontaire par rapport au prototype : ici l'état du viewer
 * (`JakartoViewerHandle`) est renvoyé par instance plutôt que gardé dans des
 * variables de module — une page Experience Builder peut contenir plusieurs
 * instances du même widget, un état module-scoped serait donc partagé (et
 * casserait) entre elles.
 *
 * Flux d'authentification (cf. docs/research-jakartowns-api.md) :
 *   1. L'utilisateur fournit sa clé API Jakarto.
 *   2. Échange contre un cookie de session via account.jakarto.com.
 *   3. Chargement du script https://maps.jakarto.com/api/v1.js (autorisé par
 *      le cookie de session).
 *   4. Création du viewer via window.jakartowns.app.create_jakartowns(...).
 *
 * La clé API est aussi mise en cache dans localStorage (cf. `getStoredApiKey`
 * / `storeApiKey`) : `checkAuthStatus` (l'ancienne façon de détecter une
 * session déjà active) est bloqué par CORS sur `account.jakarto.com/auth`
 * depuis la plupart des origines d'embarquement, donc on ne peut pas
 * compter dessus pour éviter de redemander la clé à chaque rechargement.
 */

const JAKARTO_LOGIN_URL = 'https://account.jakarto.com/users/trade-api-key'
const JAKARTO_LOGOUT_URL = 'https://account.jakarto.com/users/logout'
const JAKARTOWNS_SCRIPT_URL = 'https://maps.jakarto.com/api/v1.js'
const JAKARTOWNS_APP_URL = 'https://maps.jakarto.com/'
const API_KEY_STORAGE_KEY = 'jakartowns-viewer:apiKey'

export interface JakartoPosition {
  latitude: number
  longitude: number
}

export interface JakartoMultipassImage {
  imageId: string
  date: string | null
}

/** Snapshot de ce que le viewer affiche actuellement. */
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
 * Le viewer n'expose PAS de méthode `.on(...)` : il dispatche ses événements
 * de navigation sur `window`, en `CustomEvent`. Confirmé en lisant le code
 * réel d'une app Jakarto en production, qui écoute exactement de cette
 * façon. Attention : ces événements sont globaux, pas scopés par instance —
 * deux widgets Jakartowns sur la même page recevraient les événements l'un
 * de l'autre (limitation de la librairie, pas de notre côté).
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
 * Récupère la clé API Jakarto mise en cache localement, si l'utilisateur
 * s'est déjà connecté avec succès sur ce navigateur.
 */
export function getStoredApiKey(): string | null {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY)
  } catch {
    // localStorage indisponible (navigation privée stricte, iframe sandboxée…) : tant pis, on redemandera la clé.
    return null
  }
}

function storeApiKey(apiKey: string): void {
  try {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  } catch {
    // idem : pas bloquant, juste moins pratique pour l'utilisateur.
  }
}

function clearStoredApiKey(): void {
  try {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch {
    // idem.
  }
}

/**
 * Échange une clé API Jakarto contre un cookie de session, et la met en
 * cache localement en cas de succès pour éviter de la redemander au
 * prochain chargement du widget.
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
 * Invalide le cookie de session Jakarto en cours et oublie la clé mise en cache.
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
  /** Appelé à chaque changement de position/image (événement `position`). */
  onViewChange?: (state: JakartoViewState) => void
}

export interface JakartoViewerHandle {
  /** Déplace la vue panoramique — utilisé pour la synchronisation carte → Jakartowns. */
  setPosition: (position: JakartoPosition) => void
  /** Affiche une image précise parmi celles disponibles au même endroit (multipass). */
  setImage: (imageId: string) => void
  /** Change l'orientation horizontale (radians, convention Jakartowns — voir buildJakartownsUrl). */
  setPan: (value: number) => void
  /** Snapshot synchrone de l'état actuel (position, image, orientation) — utilisé au clic sur "Ouvrir dans Jakartowns". */
  getViewState: () => JakartoViewState
  /** Arrête de propager les événements du viewer (à appeler au démontage du widget). */
  destroy: () => void
}

/**
 * Initialise le viewer Jakartowns dans un conteneur DOM.
 * Doit être appelé seulement après une authentification réussie.
 *
 * @returns `null` si le script/l'API Jakartowns n'a pas pu être chargé.
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

  // create_jakartowns prend un sélecteur CSS : le conteneur a besoin d'un id.
  if (!container.id) {
    container.id = `jakartowns-viewer-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  }

  return new Promise((resolve) => {
    api.app.create_jakartowns(
      `#${container.id}`,
      {
        // On cache l'en-tête natif de Jakartowns (logo/recherche/aide) — le
        // widget affiche sa propre bannière "Jakartowns" et sa propre carte
        // ArcGIS fait déjà office de mini-carte. La boussole reste utile
        // pour s'orienter dans le panorama.
        headerEnabled: false,
        minimapEnabled: false,
        compassEnabled: true
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

        // pan/tilt/fov ne sont utiles qu'au moment de construire l'URL "Ouvrir
        // dans Jakartowns" (via getViewState()) : on les garde en interne
        // sans déclencher de callback React à chaque micro-rotation.
        const onRotationEvent = (event: Event) => {
          if (destroyed) return
          state.pan = (event as CustomEvent<number>).detail
        }
        window.addEventListener('rotation', onRotationEvent)

        const onTiltEvent = (event: Event) => {
          if (destroyed) return
          state.tilt = (event as CustomEvent<number>).detail
        }
        window.addEventListener('tilt', onTiltEvent)

        const onFovEvent = (event: Event) => {
          if (destroyed) return
          state.fov = (event as CustomEvent<number>).detail
        }
        window.addEventListener('fov', onFovEvent)

        if (options.latitude != null && options.longitude != null) {
          viewer.setPosition({ latitude: options.latitude, longitude: options.longitude })
        }

        // Jakartowns ne redimensionne son canvas qu'en réaction à l'événement
        // `resize` de `window` (pas de ResizeObserver sur son propre conteneur) —
        // confirmé en observant que l'app jakassets-viewer force un
        // `window.dispatchEvent(new Event('resize'))` à chaque changement de
        // taille de son panneau contenant le viewer. Un conteneur monté par
        // React ne déclenche jamais de vrai resize de fenêtre : sans ce coup de
        // pouce, le canvas reste bloqué à sa taille de création (souvent 0x0).
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
          setImage: (imageId) => {
            if (destroyed) return
            viewer.setImage(imageId)
          },
          setPan: (value) => {
            if (destroyed) return
            viewer.setPan(value)
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
  /** Identifiant technique de l'image à ouvrir — priorisé sur lat/lng quand disponible pour pointer exactement la même capture. */
  uid?: string | null
  /** Rotation horizontale (0 = Nord, π/2 = Ouest, π = Sud). */
  pan?: number | null
  /** Inclinaison verticale (0 = horizontal, ±π/2 = zénith/nadir). */
  tilt?: number | null
  /** Champ de vision, de 10 à 100 (défaut 100). */
  fov?: number | null
  /** Année des données cartographiques à afficher, si plusieurs sont disponibles. */
  year?: number
}

/**
 * Construit une URL Jakartowns (API URL) pointant sur une position ou,
 * idéalement, sur une image précise (`uid`) — c'est ce que fait une app
 * Jakarto en production pour son bouton "Ouvrir dans Jakartowns" : elle
 * privilégie `uid` (+ pan/tilt/fov) plutôt que lat/lng dès qu'une image est
 * chargée, pour rouvrir exactement la même capture plutôt qu'une image
 * proche mais différente.
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
