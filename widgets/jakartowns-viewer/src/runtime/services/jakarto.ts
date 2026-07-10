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
 */

const JAKARTO_LOGIN_URL = 'https://account.jakarto.com/users/trade-api-key'
const JAKARTO_AUTH_CHECK_URL = 'https://account.jakarto.com/auth'
const JAKARTO_LOGOUT_URL = 'https://account.jakarto.com/users/logout'
const JAKARTOWNS_SCRIPT_URL = 'https://maps.jakarto.com/api/v1.js'

export interface JakartoPosition {
  latitude: number
  longitude: number
}

interface JakartownsViewer {
  setPosition: (position: JakartoPosition, options?: Record<string, unknown>) => void
  setTilt: (value: number) => void
  setPan: (value: number) => void
  setFov: (value: number) => void
  setImage: (uid: string) => void
  setMarkers: (geojson: unknown) => void
  on: (event: 'position' | 'rotation' | 'tilt' | 'fov', handler: (payload: any) => void) => void
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
 * Vérifie si le cookie de session Jakarto en cours est encore valide.
 */
export async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch(JAKARTO_AUTH_CHECK_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      mode: 'cors'
    })
    return response.ok
  } catch (error) {
    console.error('[Jakarto] Vérification du statut d\'authentification échouée :', error)
    return false
  }
}

/**
 * Échange une clé API Jakarto contre un cookie de session.
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
    return response.ok
  } catch (error) {
    console.error('[Jakarto] Authentification échouée :', error)
    return false
  }
}

/**
 * Invalide le cookie de session Jakarto en cours.
 */
export async function logout(): Promise<boolean> {
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
  headerEnabled?: boolean
  minimapEnabled?: boolean
  latitude?: number
  longitude?: number
  /** Appelé quand l'utilisateur navigue dans le panorama (événement `position`). */
  onNavigate?: (position: JakartoPosition) => void
}

export interface JakartoViewerHandle {
  /** Déplace la vue panoramique — utilisé pour la synchronisation carte → Jakartowns. */
  setPosition: (position: JakartoPosition) => void
  /** Arrête de propager les événements du viewer (à appeler au démontage du widget). */
  destroy: () => void
}

/**
 * Initialise le viewer Jakartowns dans un conteneur DOM.
 * Doit être appelé seulement après une authentification réussie
 * (`authenticate` ou `checkAuthStatus` ayant renvoyé `true`).
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
        headerEnabled: options.headerEnabled ?? true,
        minimapEnabled: options.minimapEnabled ?? false
      },
      (viewer) => {
        let destroyed = false

        viewer.on('position', ({ latitude, longitude }) => {
          if (destroyed) return
          options.onNavigate?.({ latitude, longitude })
        })

        if (options.latitude != null && options.longitude != null) {
          viewer.setPosition({ latitude: options.latitude, longitude: options.longitude })
        }

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
          destroy: () => {
            destroyed = true
          }
        })
      }
    )
  })
}
