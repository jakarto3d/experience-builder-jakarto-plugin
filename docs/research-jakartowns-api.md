# Recherche — API Jakartowns (JS + URL)

Notes de recherche (2026-07-10), en complément du prototype
`esri_js_sdk_demo` (déjà écrit par un ex-collègue, service `jakarto.js`) et des
liens fournis par l'utilisateur.

## 1. Authentification

Flux confirmé par le [gist de référence](https://gist.github.com/Tofull/3a96b8789871ce5fbee69f2b67a7adaf) :

- L'utilisateur fournit sa clé API Jakarto (page
  `https://solutions.jakarto.com/profile` pour la récupérer).
- Échange de la clé contre un cookie de session via
  `POST https://account.jakarto.com/users/trade-api-key` (`credentials:
  'include'`, cookie **partitionné** — donc `SameSite`/`Partitioned`
  friendly, ce qui est important vu que le widget vivra dans un iframe/app
  hébergée sur un domaine Esri, pas sur `jakarto.com`).
- Vérification du statut : `GET https://account.jakarto.com/auth`.
- Déconnexion : `POST https://account.jakarto.com/users/logout`.

C'est exactement ce qu'implémente déjà `esri_js_sdk_demo/services/jakarto.js`.
Le widget ExB reprend le même flux (formulaire de clé API par utilisateur,
décision confirmée avec l'utilisateur).

## 2. Chargement du script

Une fois authentifié (cookie de session posé), charger dynamiquement :

```html
<script src="https://maps.jakarto.com/api/v1.js"></script>
```

Le script s'appuie sur le cookie de session pour autoriser l'accès. Il expose
`window.jakartowns`.

## 3. API JavaScript — initialisation

```js
window.jakartowns.app.create_jakartowns(
  '#selector',        // sélecteur CSS du conteneur
  {
    headerEnabled: true,     // affiche l'en-tête Jakartowns
    minimapEnabled: false,   // désactive la mini-carte intégrée (on a déjà la carte ArcGIS)
  },
  (viewer) => {
    // callback avec l'instance viewer, une fois prête
  }
)
```

Source : [Exemple d'intégration](https://docs.jakarto.com/guide-jakartowns/fr/developpeurs/api-javascript/exemple-dintegration)

`minimapEnabled: false` est pertinent pour nous : dans le widget ExB, la
"mini-carte" c'est la vraie carte ArcGIS à côté, pas besoin de la dupliquer.

## 4. Méthodes du `viewer`

| Méthode | Rôle |
|---|---|
| `setPosition({ latitude, longitude }, options?)` | Déplace la vue panoramique ; supporte filtre par date et contrainte de distance |
| `setImage(uid)` | Affiche une image panoramique précise par identifiant technique |
| `setTilt(value)` | Inclinaison verticale |
| `setPan(value)` | Rotation horizontale |
| `setFov(value)` | Champ de vision |
| `setMarkers(geojson)` | Projette des points d'intérêt (GeoJSON) sur les panoramas |

Source : [Référence API JS](https://docs.jakarto.com/guide-jakartowns/fr/developpeurs/api-javascript/references-de-lapi)

## 5. Événements du `viewer`

| Événement | Déclenchement |
|---|---|
| `position` | Changement de position ; inclut les images disponibles à cet endroit (`multipassAtLocation`, utile pour un sélecteur de date/image) |
| `rotation` | Rotation horizontale modifiée |
| `tilt` | Inclinaison verticale modifiée |
| `fov` | Champ de vision modifié |

C'est l'événement `position` qui alimente la synchronisation
Jakartowns → carte ArcGIS (`view.goTo(...)`), symétrique au clic sur la carte
qui alimente ArcGIS → Jakartowns (`viewer.setPosition(...)`).

## 6. API URL (alternative iframe, non retenue pour le MVP)

```
https://maps.jakarto.com/?lat={latitude}&lng={longitude}&pan={pan}&tilt={tilt}&fov={fov}&year={year}
```

Simple à embarquer en `<iframe>`, mais pas de canal documenté pour écouter la
navigation de l'utilisateur *dans* l'iframe (pas de `postMessage` documenté)
→ sync unidirectionnelle uniquement (carte → Jakartowns). Gardé comme piste
de repli si l'intégration JS API s'avère bloquée par des contraintes CSP/iframe
du portail ArcGIS (à vérifier une fois en environnement réel — cf. limitations
dans `docs/research-experience-builder.md`).
