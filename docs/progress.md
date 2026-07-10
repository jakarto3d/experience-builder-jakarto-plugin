# Journal d'avancement

Format : le plus récent en haut. Chaque entrée correspond à un commit.

## 2026-07-10 — Refonte UX : panneau flottant, mode pointage, multipass, date, persistance de la clé

Demande utilisateur : rendre l'UI plus sobre/moderne, et ajouter plusieurs
comportements inspirés de l'asset viewer Jakarto (`jakassets-viewer`, déjà
consulté plus haut pour le debug).

- **Service `jakarto.ts`** : `initializeViewer` suit maintenant, en plus de
  la position, les événements `rotation`/`tilt`/`fov` (globaux sur
  `window`, comme `position`) et expose `getViewState()` (snapshot
  synchrone) + `setImage(uid)`. Choix volontaire : pan/tilt/fov ne
  déclenchent PAS de callback React à chaque micro-rotation (que la souris
  peut envoyer très souvent) — ils restent en interne, lus seulement au
  clic sur "Ouvrir dans Jakartowns" via `getViewState()`. Évite un churn de
  re-render inutile.
- **`buildJakartownsUrl`** privilégie désormais le paramètre `uid` (image
  exacte) sur lat/lng dès qu'une image est chargée — reprend exactement le
  pattern du bouton de redirection de `jakassets-viewer`
  (`?pan=…&tilt=…&fov=…&uid=…`, sans lat/lng).
- **Persistance de la clé API** : `authenticate()` la sauvegarde dans
  `localStorage` (`jakartowns-viewer:apiKey`) en cas de succès ; `logout()`
  l'efface. Au montage, le widget tente une reconnexion automatique avec la
  clé en cache. Remplace l'ancien `checkAuthStatus()` (supprimé — bloqué par
  CORS dans la plupart des contextes, ne servait plus à rien).
  **Compromis assumé** : la clé est en clair côté navigateur, pas chiffrée.
- **`create_jakartowns`** : `headerEnabled: false` (le widget affiche sa
  propre bannière "Jakartowns", rendant le header natif redondant),
  `compassEnabled: true`. `config.ts`/`config.json`/`setting.tsx` simplifiés
  en conséquence (ces deux options ne sont plus configurables, elles sont
  fixées côté code).
- **Panneau flottant** : le panorama (+ toolbar + login + date + multipass)
  vit dans un panneau `position: absolute`, avec une barre de titre
  affichant "Jakartowns" (mention explicite demandée), un bouton
  replier/déplier (chevron), et un bouton déconnexion qui ne recouvre plus
  le panorama (contrairement à l'ancien bouton flottant par-dessus). La
  barre de titre sert aussi de poignée de glisser-déposer (Pointer Events),
  avec la position bornée aux limites du widget lui-même — pas de vrai
  Picture-in-Picture hors fenêtre (voir décision ci-dessous).
- **Mode pointage** : la carte ne réagit plus à *chaque* clic (source de
  frustration potentielle si l'utilisateur clique pour d'autres raisons).
  Un bouton arme un clic gauche ponctuel (désarmé automatiquement après
  usage) ; le clic droit sur la carte fonctionne lui à tout moment sans
  rien armer (implémenté via un écouteur DOM natif `contextmenu` sur
  `view.container`, `view.toMap()` pour convertir l'écran en coordonnées
  carte, `preventDefault()` pour supprimer le menu contextuel du
  navigateur — l'API MapView elle-même n'expose pas d'événement clic droit).
- **Date + multipass** : la date de l'image affichée vient de
  `currentSphereInfo.properties.date` (événement `position`), la liste des
  images disponibles au même endroit de `multipassAtLocation` — même
  source de données que la liste que `jakassets-viewer` construit pour son
  propre sélecteur. Affiché seulement si plus d'une image est disponible.

### Décision : pas de vrai Picture-in-Picture pour l'instant

L'utilisateur a suggéré un mode "PiP" qui sortirait le panneau de la
fenêtre du navigateur (pas juste le déplacer dans le widget). L'API
`documentPictureInPicture` (Chrome/Edge) permettrait ça, mais elle déplace
réellement le nœud DOM vers un autre `document` — risque concret de perte
du contexte WebGL du canvas Jakartowns pendant ce transfert (comportement
non garanti, dépend du navigateur). Vu le risque de casser le panorama pour
un gain incertain, j'ai implémenté le déplacement/repli *dans* les limites
du widget (couvre la demande principale) et documenté le vrai PiP comme
piste future séparée plutôt que de le tenter à l'aveugle dans cette
itération.

## 2026-07-10 — 🎉 Premier succès de bout en bout

Confirmé par l'utilisateur : le panorama Jakartowns s'affiche maintenant
dans le widget, et cliquer sur la carte ArcGIS liée déplace bien le
panorama au bon endroit (adresse affichée dans la barre Jakartowns cohérente
avec le point cliqué). Les quatre bugs trouvés dans cette session de debug
(`config.json` manquant, `useMapWidgetIds` au lieu de `useMapWidgetId`,
`viewer.on()` inexistant, collision d'id `#app`) formaient la chaîne
complète de blocages — plus aucun d'entre eux ne semble bloquant.

Reste à valider (non testé à ce stade) :
- La synchro dans l'autre sens : naviguer/tourner dans le panorama doit
  recentrer la carte ArcGIS (`view.goTo(...)`, événement `position` déjà
  câblé sur ce même event `window` corrigé plus haut — devrait fonctionner
  mais pas encore confirmé visuellement).
- Le lien "Ouvrir dans Jakartowns ↗" (API URL, visible dans les captures
  mais pas encore cliqué/vérifié).
- Le comportement en dehors de `localhost` (le CORS sur `account.jakarto.com`
  pourrait se comporter différemment sur le domaine réel du portail
  `sig.mascouche.ca`).

## 2026-07-10 — Deux bugs de plus trouvés via la Console : `.on()` inexistant + collision d'id `#app`

En regardant la Console (pas seulement Network) après le fix précédent,
l'utilisateur a trouvé l'erreur bloquante qui expliquait tout depuis le
début :

```
Uncaught TypeError: viewer.on is not a function
  at jakarto.ts:177:16
```

Notre code appelait `viewer.on('position', ...)` juste après la création du
viewer. Cette méthode n'existe pas sur l'instance réelle — l'erreur est levée
en synchrone dans le callback de `create_jakartowns`, donc **tout ce qui suit
dans ce callback ne s'exécutait jamais** : ni notre `viewer.setPosition(...)`
initial, ni le dispatch de resize ajouté juste avant, ni le `resolve()` de la
promesse (`initializeViewer` ne se terminait donc jamais). Ça explique
pourquoi le fix resize précédent n'avait aucun effet observable : il ne
s'exécutait tout simplement pas.

En recroisant avec le code réel de `jakassets-viewer` (déjà consulté plus
haut), confirmé que la navigation dans le panorama est en fait notifiée via
un événement global sur `window`, pas une méthode sur l'instance :
```js
window.addEventListener('position', (e) => { /* e.detail.latitude, e.detail.longitude */ })
```
**Fix** dans `services/jakarto.ts` : remplacé `viewer.on('position', ...)`
par `window.addEventListener('position', ...)`, avec retrait de l'écouteur
dans `destroy()`. Limitation à noter : cet événement est global (pas scopé
par instance) — deux widgets Jakartowns simultanés sur la même page
recevraient les événements l'un de l'autre. C'est une limitation de la
librairie Jakartowns elle-même, pas quelque chose qu'on peut corriger côté
widget.

Deuxième bug trouvé en parallèle (piste CSS explorée manuellement par
l'utilisateur dans DevTools, "en jouant avec le CSS j'ai réussi à afficher
qqch") : une règle CSS globale `#app { ...; display: none; }` cachait le
panorama. Cause : Jakartowns monte sa propre appli interne dans une div avec
`id="app"` codé en dur par sa librairie, imbriquée dans notre conteneur.
Experience Builder a probablement sa propre racine `id="app"` ailleurs sur
la page, et une règle qui lui est destinée (probablement pour éviter un
flash avant hydratation) retombe aussi sur la div interne de Jakartowns à
cause de la collision d'id (les sélecteurs CSS par id ciblent tout élément
portant cet id, peu importe l'imbrication). **Fix** : règle plus spécifique
`.jakartowns-viewer-panorama #app { display: flex; }` dans `widget.css`,
qui neutralise le `display:none` uniquement pour l'instance imbriquée, sans
toucher à la vraie racine d'Experience Builder.

Corrigé au passage : le `console.error` de `checkAuthStatus()` passé en
`console.info`, puisque l'échec CORS observé sur `account.jakarto.com/auth`
(origine `localhost:3001` non autorisée) est un mode d'échec attendu — il ne
bloque que la détection automatique "déjà connecté", pas la connexion
manuelle par clé API qui elle passe par un autre endpoint.

Bruit sans rapport observé dans la Console, propre à l'environnement local
de l'utilisateur (pas d'action de notre côté) : erreur SSL sur le service
worker d'Experience Builder (certificat auto-signé du serveur de dev) et
tuiles Hillshade 404 (couche de base du web map de démo utilisé pour les
tests).

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
