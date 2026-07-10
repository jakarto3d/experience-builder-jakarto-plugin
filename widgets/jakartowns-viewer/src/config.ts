import { type ImmutableObject } from 'jimu-core'

/**
 * Options exposées dans le panneau de réglages du widget (voir src/setting/setting.tsx).
 * `useMapWidgetIds` (la liaison à un widget Map) est un champ standard d'Experience
 * Builder, géré séparément par le framework — il n'apparaît pas ici.
 *
 * Les valeurs par défaut vivent dans ../config.json (pas ici) : sans ce fichier,
 * Experience Builder marque le widget `hasConfig: false` et `props.config` reste
 * indéfini, ce qui fait planter le panneau de réglages au chargement.
 */
export interface Config {
  /** true = affiche l'en-tête natif de Jakartowns dans le conteneur intégré. */
  headerEnabled: boolean
  /** true = affiche la mini-carte native de Jakartowns (inutile ici : la carte ArcGIS liée en tient déjà lieu). */
  minimapEnabled: boolean
  /** Position de repli tant qu'aucun clic/extent n'a été reçu de la carte liée. */
  fallbackLatitude: number
  fallbackLongitude: number
}

export type IMConfig = ImmutableObject<Config>
