# Journal d'avancement

Format : le plus récent en haut. Chaque entrée correspond à un commit.

## 2026-07-10 — Le canvas Jakartowns reste à 0x0 : Jakartowns dépend du resize de `window`

Après le fix du panneau de réglages, le widget se connecte, s'authentifie et
charge bien les tuiles Jakartowns (confirmé par le Network : `extents`,
`tileset.json`, `.webp`, `spheres` tous en 200). Mais rien ne s'affichait
visuellement. Diagnostic avec l'utilisateur (DevTools) : un `<canvas>` est
bien créé par Jakartowns dans notre conteneur, mais avec des attributs
`width="0" height="0"` — le canvas existe mais son buffer de rendu est vide.

En creusant le code d'une vraie app Jakarto en prod (référence indiquée par
l'utilisateur, non listée ici), trouvé la preuve dans son store
`userInterface.js` : à chaque changement de taille du panneau contenant le
viewer (ex. agrandir/réduire le panneau de détail), l'app force explicitement :
```js
nextTick(() => {
  const resizeEvent = new Event('resize')
  window.dispatchEvent(resizeEvent)
})
```
Ça confirme le mécanisme réel : **Jakartowns ne redimensionne son canvas
qu'en réaction à l'événement `resize` de `window`**, pas via un
`ResizeObserver` sur son propre conteneur. Un widget monté par React dans
Experience Builder ne déclenche jamais de vrai resize de fenêtre — le canvas
reste donc bloqué à sa taille de création.

**Fix** dans `services/jakarto.ts` (`initializeViewer`) :
- Un `requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))`
  juste après la création du viewer, pour forcer une première mesure une
  fois le DOM/layout stabilisé.
- Un `ResizeObserver` sur le conteneur qui redéclenche le même événement à
  chaque changement de taille réel (ex. redimensionnement du widget dans le
  builder), avec `disconnect()` dans `destroy()`.

Synchronisé directement dans l'installation Developer Edition de
l'utilisateur (pas besoin de redémarrer `npm start` pour ce fichier — contrairement
à `config.json`/`manifest.json`, les `.ts` sont repris à chaud par le serveur
de dev). À valider par l'utilisateur.

## 2026-07-10 — Premiers tests en environnement réel : deux bugs corrigés

L'utilisateur a maintenant accès à une vraie Developer Edition ArcGIS
Experience Builder et y a copié `widgets/jakartowns-viewer/`. Premiers
résultats : **le widget compile et s'affiche** dans le canvas (le placeholder
français apparaît correctement). Par contre le panneau de réglages du widget
n'affichait que "Size & Position" (les contrôles génériques), sans les onglets
Content/Style/Action attendus — impossible de lier un widget Map.

Diagnostic fait en inspectant directement les sources de la Developer Edition
(types réels de `jimu-core`/`jimu-arcgis`/`jimu-ui`, et le fichier généré
`client/dist/widgets/widgets-info.json`) :

1. **Cause racine confirmée** : notre widget n'a pas de `config.json` à sa
   racine (contrairement au widget d'exemple officiel `simple`, comparé
   directement). Sans ce fichier, le build marque
   `manifest.properties.hasConfig = false` (visible dans
   `widgets-info.json`), et `props.config` reste vraisemblablement
   indéfini côté panneau de réglages — `setting.tsx` plantait donc en lisant
   `props.config.headerEnabled`, ce qui faisait tomber tout le panneau
   (Content/Style/Action) sur l'affichage de secours générique.
   → **Fix** : ajout de `widgets/jakartowns-viewer/config.json` avec les
   valeurs par défaut (`headerEnabled: true, minimapEnabled: false,
   fallbackLatitude/Longitude`). L'export `defaultConfig` désormais inutile
   a été retiré de `src/config.ts` pour éviter d'avoir deux sources de
   vérité.
2. **Bug fonctionnel confirmé séparément** (aurait cassé la liaison à la
   carte une fois le panneau de réglages fonctionnel) : `widget.tsx` passait
   `useMapWidgetIds` (pluriel, un tableau) à `<JimuMapViewComponent>`, qui
   attend en réalité `useMapWidgetId` (singulier, un seul id) — confirmé
   par l'exemple donné dans le commentaire JSDoc de la classe `JimuMapView`
   elle-même (`client/jimu-arcgis/lib/views/jimu-map-view.d.ts`).
   → **Fix** : `useMapWidgetId={useMapWidgetIds[0]}`.
3. Corrigé au passage dans `setting.tsx` : le callback `onSelect` de
   `MapWidgetSelector` reçoit un `string[]` simple, pas un
   `ImmutableArray<string>` (sans impact fonctionnel ici — le build de dev
   utilise `ts-loader` en mode `transpileOnly`, donc les erreurs de type
   n'empêchent pas la compilation — mais corrigé pour rester correct).

**À faire par l'utilisateur** : redémarrer le serveur de dev (`npm start`
depuis `client/`) pour que `config.json` soit repris en compte (le fichier
`widgets-info.json` est régénéré au démarrage, pas à chaud), puis rouvrir le
widget dans le builder et vérifier que les onglets Content/Style/Action
apparaissent avec le sélecteur de carte.

## 2026-07-10 — Ouverture via l'API URL (fallback indépendant de l'auth JS API)

- Demande utilisateur : avoir un moyen d'ouvrir Jakartowns via l'**API URL**
  (`https://maps.jakarto.com/?lat=…&lng=…`) directement depuis le widget, en
  plus de l'intégration API JS embarquée.
- `services/jakarto.ts` : ajout de `buildJakartownsUrl(position, options)`
  (options `pan`/`tilt`/`fov`/`year`, cf. doc API URL).
- `widget.tsx` : nouvelle barre d'outils persistante avec un lien
  "Ouvrir dans Jakartowns ↗" (`target="_blank"`), visible dès qu'une carte
  est liée — **indépendamment de l'état de connexion à l'API JS**. La
  position utilisée est la dernière connue (clic sur la carte ou navigation
  dans le panorama embarqué), avec repli sur `config.fallbackLatitude/Longitude`
  tant qu'aucune interaction n'a eu lieu.
- Intérêt : ce lien ne dépend pas du cookie de session partitionné ni du
  chargement du script `v1.js` — il fonctionne même si l'intégration API JS
  est bloquée par la politique cross-site du navigateur dans le contexte du
  portail (risque identifié plus haut, toujours non vérifié en environnement
  réel). Ça donne un chemin de repli fiable pendant qu'on valide le reste.

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
