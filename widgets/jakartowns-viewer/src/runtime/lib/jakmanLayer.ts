/**
 * lib/jakmanLayer.ts
 *
 * Couche vectorielle affichant les positions des panoramas Jakartowns
 * disponibles ("jakman"), pour donner un repère visuel avant de cliquer sur
 * la carte. Même source de tuiles vectorielles que celle utilisée par
 * l'asset viewer Jakarto (composable `useJakmanToggleLayers`, non listé
 * ici) : un flux de tuiles vectorielles Mapbox/MapLibre, pas un service
 * ArcGIS. Le SDK ArcGIS Maps for JavaScript sait consommer ce format via
 * `VectorTileLayer` initialisé avec un style au format Mapbox GL Style
 * Spec (`sources`/`layers`), donc on réutilise directement la même URL de
 * tuiles sans dépendre de la stack MapLibre de l'asset viewer.
 *
 * Non vérifié : le endpoint de tuiles (`maps.jakarto.com/backend/tiles/...`)
 * exige-t-il le cookie de session Jakarto ? Le SDK ArcGIS n'envoie pas les
 * cookies cross-origin par défaut — un intercepteur de requêtes
 * (`esriConfig.request.interceptors`) force `credentials: 'include'`
 * spécifiquement pour cet hôte, au cas où. À confirmer visuellement une
 * fois testé (couche vide/erreurs 401-403 dans le Network si le cookie ne
 * suffit pas).
 */

const JAKMAN_SPHERES_TILE_URL = 'https://maps.jakarto.com/backend/tiles/data/spheres/{z}/{x}/{y}.pbf'
const JAKMAN_TILE_HOST = 'https://maps.jakarto.com/backend/tiles'

export const JAKMAN_SPHERES_STYLE = {
  version: 8,
  sources: {
    jakman_spheres: {
      type: 'vector',
      tiles: [JAKMAN_SPHERES_TILE_URL],
      minzoom: 0,
      maxzoom: 14
    }
  },
  layers: [
    {
      id: 'jakman-spheres',
      type: 'circle',
      source: 'jakman_spheres',
      'source-layer': 'spheres',
      paint: {
        'circle-color': '#191970',
        'circle-radius': {
          stops: [[8, 1], [11, 2], [16, 3]]
        }
      }
    }
  ]
}

let interceptorRegistered = false

/**
 * Force l'envoi du cookie de session sur les requêtes vers l'hôte des
 * tuiles jakman — à appeler une seule fois (idempotent) avant de créer la
 * couche.
 */
export function ensureJakmanRequestCredentials(esriConfig: any): void {
  if (interceptorRegistered) return
  interceptorRegistered = true
  esriConfig.request.interceptors = esriConfig.request.interceptors ?? []
  esriConfig.request.interceptors.push({
    urls: JAKMAN_TILE_HOST,
    before: (params: any) => {
      params.requestOptions.credentials = 'include'
    }
  })
}
