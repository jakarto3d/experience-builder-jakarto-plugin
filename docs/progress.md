# Journal d'avancement

Format : le plus récent en haut. Chaque entrée correspond à un commit.

## 2026-07-10 — MVP scaffold complet, corrections de finition

- `manifest.json` : `translatedLocales` corrigé à `["fr"]` (une seule
  locale traduite dans `translations/default.ts` pour l'instant — déclarer
  `"en"` sans fichier `en.ts` associé aurait été trompeur).
- `widgets/jakartowns-viewer/README.md` : statut mis à jour + checklist de
  vérification à faire une fois le widget déployé dans une vraie
  installation Experience Builder (compilation TS, cookie partitionné
  cross-site, conflits de clic avec d'autres widgets, fluidité du `goTo`
  pendant une navigation continue, responsive du formulaire de connexion).
- **Bilan de cette itération** : le widget est complet en l'état de l'art
  documenté (manifest, config, liaison carte, auth, embed, sync
  bidirectionnelle), mais reste **non compilé et non testé** faute
  d'accès à une Developer Edition ArcGIS Experience Builder. La suite
  logique est : obtenir/installer une Developer Edition, copier
  `widgets/jakartowns-viewer/` dans `client/your-extensions/widgets/`, et
  lever un par un les points de la checklist du README du widget.

## 2026-07-10 — Synchronisation bidirectionnelle carte ↔ Jakartowns

- `src/runtime/hooks/useSpatialSync.ts` : portage du composable Vue
  `useSpatialSync` en hook React (anti-rebond 300 ms pour éviter les boucles
  carte → Jakartowns → carte → …).
- `src/runtime/widget.tsx` complété :
  - Formulaire de connexion par clé API Jakarto (par utilisateur, cf.
    décision du 2026-07-10 plus bas) affiché tant que non authentifié.
  - Une fois authentifié : initialise le viewer Jakartowns
    (`services/jakarto.initializeViewer`) dans un conteneur dédié, avec pour
    position de départ le centre de la carte liée (repli sur
    `config.fallbackLatitude/Longitude` si la carte n'a pas encore de
    centre).
  - Clic sur la `MapView` liée (`jimuMapView.view.on('click', …)`) →
    `viewerHandle.setPosition(...)`.
  - Événement `position` du viewer Jakartowns → `view.goTo(...)` sur la
    carte liée.
  - Utilisation d'un `ref` (`jimuMapViewRef`) synchronisé sur l'état
    `jimuMapView` pour que les callbacks du viewer (créés une seule fois, à
    l'authentification) lisent toujours la vue active courante sans avoir à
    redémarrer le viewer à chaque changement de vue.
- Non vérifié (pas d'environnement ExB réel) : le comportement exact de
  `view.on('click')` combiné à d'autres widgets qui interceptent aussi les
  clics sur la même carte (ex. widget de sélection), et la performance du
  `goTo` avec `duration: 600` quand les événements `position` de Jakartowns
  arrivent à haute fréquence pendant un déplacement continu dans le
  panorama — un anti-rebond plus agressif ou un throttle pourrait être
  nécessaire selon le retour réel.

## 2026-07-10 — Démarrage : recherche + décisions d'architecture

- Repo de départ : un prototype Vue autonome (`esri_js_sdk_demo`, écrit par un
  ex-collègue) qui démontre la synchronisation carte ArcGIS ↔ panorama
  Jakartowns, mais qui n'est **pas** un widget Experience Builder (pas de
  `manifest.json`, pas de `jimu-core`, structure Vue standalone).
- Recherche menée sur : l'architecture des widgets custom ExB (voir
  [research-experience-builder.md](research-experience-builder.md)) et l'API
  Jakartowns (voir [research-jakartowns-api.md](research-jakartowns-api.md)).
- Décisions validées avec l'utilisateur :
  1. Pas de Developer Edition ExB disponible localement → on scaffold le
     widget dans ce dépôt (`widgets/jakartowns-viewer/`), à copier plus tard
     dans `client/your-extensions/widgets/`.
  2. Authentification Jakartowns **par utilisateur** (saisie de clé API),
     pas de clé de service partagée.
  3. Intégration via **l'API JavaScript** Jakartowns (pas iframe/API URL),
     liée directement à la `MapView` du widget Map choisi, via
     `JimuMapViewComponent` (`jimu-arcgis`) — le pattern du widget Legend
     officiel d'Esri.
- Prochaine étape : scaffold du squelette minimal du widget (manifest, icon,
  config, widget.tsx placeholder, setting.tsx avec sélecteur de carte).

### Risques / limitations connus à ce stade

- Le code du widget ne peut pas être compilé ni testé localement (pas de
  `jimu-core`/`jimu-arcgis` disponibles hors d'une installation Developer
  Edition réelle). Écrit pour être conforme aux exemples officiels, mais à
  valider dès dépôt dans un environnement réel.
- Le comportement de l'authentification par cookie partitionné Jakartowns
  dans le contexte d'un widget hébergé sous un domaine ArcGIS (portail
  `sig.mascouche.ca`) n'est pas encore vérifié — risque de blocage
  cross-site cookie selon la politique du navigateur. À tester en premier
  lors de la mise en environnement réel.
