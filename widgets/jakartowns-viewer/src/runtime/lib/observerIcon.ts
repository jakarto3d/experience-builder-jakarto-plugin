/**
 * lib/observerIcon.ts
 *
 * Reproduit l'"Observer Icon" de @jakarto3d/jakui (composant Vue
 * `V2ObserverIcon`, utilisé par jakassets-viewer pour indiquer la position
 * et l'orientation du panorama sur la carte) : un point en dégradé
 * (position) + un arc en dégradé représentant le champ de vision (fov).
 *
 * Géométrie et calculs (dasharray/dashoffset pour dessiner un arc partiel
 * via le cercle plein — technique SVG standard, arc "ombre" à 90% de la
 * longueur de l'arc principal pour un effet de profondeur) portés tels
 * quels depuis le composant compilé de @jakarto3d/jakui
 * (dist/jakui.es.js, fonction `V2ObserverIcon`).
 *
 * Le SVG généré ici "pointe vers le haut" (Nord) par défaut ; la rotation
 * par cap n'est PAS incluse dedans — elle est appliquée séparément via
 * `PictureMarkerSymbol.angle` côté ArcGIS (voir widget.tsx), pour ne
 * jamais avoir à régénérer l'image à chaque micro-rotation. Seul un
 * changement de fov nécessite une régénération.
 */

// Jetons --ds-color-observer-* de @jakarto3d/jakui (thème clair, valeurs
// copiées depuis node_modules/@jakarto3d/jakui/dist/tokens/semantic.css —
// le paquet lui-même n'est pas chargé dans Experience Builder).
const DOT_START = 'hsl(281, 42%, 37%)' // --ds-color-purple-500
const DOT_END = 'hsl(212, 49%, 38%)' // --ds-color-primary-500
const ARC_INNER = 'hsl(212, 49%, 38%)' // --ds-color-primary-500
const ARC_OUTER = 'hsl(133, 32%, 43%)' // --ds-color-green-500
const ARC_SHADOW = 'hsl(212, 49%, 38%)' // --ds-color-primary-500

// Mêmes valeurs par défaut que V2ObserverIcon.
export const OBSERVER_ICON_SIZE = 48
const DOT_RADIUS = 5
const ARC_RADIUS = 14
const STROKE_WIDTH = 6
export const DEFAULT_OBSERVER_FOV = 60

export function buildObserverIconSvg(fovDegrees: number): string {
  const half = OBSERVER_ICON_SIZE / 2
  const fov = Math.min(360, Math.max(0, fovDegrees))

  const innerR = Math.max(0, ARC_RADIUS - STROKE_WIDTH / 2)
  const outerR = ARC_RADIUS + STROKE_WIDTH / 2
  const innerStopPercent = outerR <= 0 ? 0 : (innerR / outerR) * 100

  const circumference = 2 * Math.PI * ARC_RADIUS
  const arcLength = circumference * (fov / 360)
  // Décale le début du tracé pour centrer l'arc visible sur le "haut" (Nord) :
  // un quart de tour (0.25) + la moitié de la portion angulaire de l'arc.
  const dashOffsetMain = circumference * (0.25 + fov / 720)
  const gapLength = Math.max(0, circumference - arcLength)

  const shadowArcLength = arcLength * 0.9
  const shadowDashOffset = circumference * 0.25 + shadowArcLength / 2
  const shadowGapLength = Math.max(0, circumference - shadowArcLength)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OBSERVER_ICON_SIZE}" height="${OBSERVER_ICON_SIZE}" viewBox="${-half} ${-half} ${OBSERVER_ICON_SIZE} ${OBSERVER_ICON_SIZE}">
  <defs>
    <linearGradient id="dot" gradientUnits="userSpaceOnUse" x1="0" y1="${DOT_RADIUS}" x2="0" y2="${-DOT_RADIUS}">
      <stop offset="0%" stop-color="${DOT_START}" />
      <stop offset="100%" stop-color="${DOT_END}" />
    </linearGradient>
    <radialGradient id="arc" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${outerR}">
      <stop offset="0%" stop-color="${ARC_INNER}" />
      <stop offset="${innerStopPercent}%" stop-color="${ARC_INNER}" />
      <stop offset="100%" stop-color="${ARC_OUTER}" />
    </radialGradient>
  </defs>
  <circle cx="0" cy="0" r="${DOT_RADIUS}" fill="url(#dot)" />
  <circle cx="0" cy="0" r="${ARC_RADIUS}" fill="none" stroke="${ARC_SHADOW}" stroke-width="${STROKE_WIDTH}" stroke-linecap="butt" stroke-dasharray="${shadowArcLength} ${shadowGapLength}" stroke-dashoffset="${shadowDashOffset}" />
  <circle cx="0" cy="0" r="${ARC_RADIUS}" fill="none" stroke="url(#arc)" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-dasharray="${arcLength} ${gapLength}" stroke-dashoffset="${dashOffsetMain}" />
</svg>`
}

export function buildObserverIconDataUrl(fovDegrees: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildObserverIconSvg(fovDegrees))}`
}
