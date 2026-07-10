/**
 * lib/lookAt.ts
 *
 * Petite trigonométrie pour tenter de garder le même point de repère
 * visuel quand on bascule d'une image multipass à une autre : les images
 * "au même endroit" ne sont pas forcément prises exactement à la même
 * position (véhicule de capture sur une voie différente, quelques mètres
 * d'écart…). On calcule donc un point cible ~20m devant la vue actuelle,
 * puis on réoriente la caméra vers ce même point une fois la nouvelle
 * image chargée à sa propre position.
 *
 * Approche en 2 temps :
 *   1. Avant de changer d'image : projeter un point à `LOOK_AHEAD_DISTANCE_METERS`
 *      devant la position/orientation actuelles (cap standard, boussole,
 *      sens horaire depuis le Nord).
 *   2. Après le changement d'image (nouvelle position connue via
 *      l'événement `position` suivant) : calculer le pan nécessaire, depuis
 *      cette nouvelle position, pour regarder vers ce même point.
 */

export interface LatLng {
  lat: number
  lng: number
}

/** Distance par défaut du point visé, en mètres — cf. demande initiale ("un objet à 20m devant"). */
export const LOOK_AHEAD_DISTANCE_METERS = 20

const EARTH_RADIUS_METERS = 6371000

/**
 * Point atteint en partant de `origin`, en ligne droite sur `distanceMeters`,
 * selon un cap standard (0 = Nord, sens horaire — ce qu'utilisent
 * généralement les métadonnées de capture). Formule classique du "point de
 * destination" sur sphère ; l'approximation sphérique est largement
 * suffisante sur des distances de l'ordre de la dizaine de mètres.
 */
export function projectPoint(origin: LatLng, bearingRadians: number, distanceMeters: number): LatLng {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS
  const lat1 = (origin.lat * Math.PI) / 180
  const lng1 = (origin.lng * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians)
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  )

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

/**
 * Convertit un angle entre la convention "pan" de Jakartowns (0 = Nord,
 * π/2 = Ouest — donc sens antihoraire, cf. docs/research-jakartowns-api.md)
 * et un cap standard (0 = Nord, sens horaire), ou inversement — c'est une
 * simple réflexion, donc la même formule fonctionne dans les deux sens.
 * Vérifié numériquement sur des cas Nord/Est/Ouest/Sud avant d'être utilisé.
 */
export function reflectAngle(angleRadians: number): number {
  const twoPi = 2 * Math.PI
  return ((twoPi - angleRadians) % twoPi + twoPi) % twoPi
}

/**
 * Pan (convention Jakartowns) pour regarder depuis `from` vers `to`.
 * Porté tel quel de `getAngleFromPoints` d'une app Jakarto en production
 * (déjà utilisée pour orienter la caméra vers un point ciblé via
 * `setPan(...)`), plutôt que re-dérivé à la main — évite de se tromper de
 * signe/convention.
 */
export function getJakartownsPanTowards(from: LatLng, to: LatLng): number {
  const dy = from.lat - to.lat
  const dx = from.lng - to.lng
  return Math.PI + Math.atan2(-dx, dy)
}
