import { React } from 'jimu-core'
import { type JakartoPosition } from '../services/jakarto'

/**
 * Coordonne la synchronisation spatiale bidirectionnelle entre la carte
 * ArcGIS liée et le panorama Jakartowns, avec un anti-rebond pour éviter les
 * boucles infinies (carte → Jakartowns → carte → …).
 *
 * Portage du composable Vue `useSpatialSync` du prototype
 * (`esri_js_sdk_demo/composables/useSpatialSync.js`) en hook React : même
 * logique, sans l'état réactif Vue (inutile ici, chaque appelant gère son
 * propre affichage).
 */
export function useSpatialSync(debounceMs = 300) {
  const isSyncingRef = React.useRef(false)

  const onMapClick = React.useCallback((position: JakartoPosition, navigateJakarto: (position: JakartoPosition) => void) => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    navigateJakarto(position)
    window.setTimeout(() => { isSyncingRef.current = false }, debounceMs)
  }, [debounceMs])

  const onJakartoNavigate = React.useCallback((position: JakartoPosition, goToMapLocation: (position: JakartoPosition) => void) => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    goToMapLocation(position)
    window.setTimeout(() => { isSyncingRef.current = false }, debounceMs)
  }, [debounceMs])

  return { onMapClick, onJakartoNavigate }
}
