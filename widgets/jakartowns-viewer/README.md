# Widget Experience Builder — Jakartowns Viewer

Widget custom qui affiche le panorama **Jakartowns** dans un panneau
flottant, synchronisé avec un widget **Map** d'ArcGIS Experience Builder.

## Statut

Testé de bout en bout dans une vraie Developer Edition ArcGIS Experience
Builder : authentification, rendu du panorama et synchronisation
bidirectionnelle avec la carte fonctionnent. Voir
[`docs/progress.md`](../../docs/progress.md) à la racine du dépôt pour le
journal détaillé de chaque étape (bugs trouvés et corrigés en cours de
route).

### Checklist restant à vérifier

- [ ] Comportement de l'authentification (clé API + cookie de session) une
      fois hébergé sous le domaine réel du portail (`sig.mascouche.ca`)
      plutôt que `localhost` — le CORS sur `account.jakarto.com` pourrait se
      comporter différemment.
- [ ] Le clic droit sur la carte (mode de repérage rapide) n'entre pas en
      conflit avec un menu contextuel d'un autre widget déjà présent sur la
      même carte.
- [ ] Le panneau flottant reste utilisable dans les tailles réduites du
      widget (voir `defaultSize` dans `manifest.json`).

## Installation dans une ArcGIS Experience Builder Developer Edition

Ce dossier n'est **pas** un projet buildable en autonomie : il doit être
copié dans le web extension repo d'une installation Developer Edition
existante.

> **Vidéo utile pour l'installation** : [Set up ArcGIS Experience Builder Developer Edition](https://www.youtube.com/watch?v=YLBxBio96a8)
> — les 20 premières minutes en particulier ont servi à installer
> l'environnement local (fonctionne aussi sur Linux, pas seulement Windows).
> Suivre les étapes de la vidéo dans l'ordre, sans en sauter.
>
> Pour l'étape OAuth de la vidéo : utiliser un compte ArcGIS Online existant
> (ici, `https://jakarto.maps.arcgis.com/`) plutôt que d'en créer un
> nouveau, et choisir le type **"OAuth 2.0 credentials - For user
> authentication"** pour les identifiants de l'application.

1. Télécharger/installer ArcGIS Experience Builder Developer Edition (voir la
   documentation Esri officielle : https://developers.arcgis.com/experience-builder/guide/getting-started-widget/).
2. Copier ce dossier entier (`jakartowns-viewer/`) dans :
   ```
   <installation-exb>/client/your-extensions/widgets/jakartowns-viewer/
   ```
3. Depuis `<installation-exb>/client`, lancer `npm start` (redémarrer le
   serveur de dev si un `manifest.json`/`config.json` a changé — seuls les
   fichiers `.ts`/`.tsx`/`.css` sont repris à chaud).
4. Ouvrir le builder ExB local, ajouter le widget **Jakartowns Viewer** à une
   page contenant déjà un widget **Map**.
5. Dans les réglages du widget, sélectionner le widget Map à lier
   (`Carte liée`).

## Utilisation

- Un visiteur doit renseigner sa propre clé d'API Jakarto (récupérable sur
  https://solutions.jakarto.com/profile) — décision produit : pas de clé
  partagée par défaut. Cette clé est mise en cache dans le `localStorage` du
  navigateur après une connexion réussie, pour éviter d'avoir à la ressaisir
  à chaque visite (le endpoint de vérification de session est bloqué par
  CORS depuis la plupart des origines, on ne peut donc pas s'y fier pour
  détecter une session déjà active). Compromis assumé : la clé est stockée
  en clair côté navigateur, pas chiffrée.
- Le panorama vit dans un **panneau flottant** au-dessus de la carte :
  - Repliable/dépliable via le bouton chevron de la barre de titre.
  - Déplaçable en le faisant glisser par sa barre de titre (limité aux
    bords du widget).
- Deux façons de pointer un endroit sur la carte liée :
  - **Mode pointage** : cliquer sur le bouton "Cliquer sur la carte" puis
    sur la carte — se désarme automatiquement après usage (évite que
    chaque clic sur la carte, y compris ceux destinés à d'autres outils,
    ne déplace le panorama).
  - **Clic droit** sur la carte : fonctionne à tout moment, sans rien armer.
- La **date de l'image actuellement affichée** est visible en overlay sur le
  panorama. Si plusieurs captures existent au même endroit (multipass), une
  liste de dates apparaît pour basculer entre elles.
- Le bouton **"Ouvrir dans Jakartowns ↗"** ouvre `maps.jakarto.com` dans un
  nouvel onglet sur **l'image exacte actuellement affichée** (via son
  identifiant technique, pas seulement lat/lng) — fonctionne aussi comme
  repli si l'intégration embarquée ne s'authentifie pas correctement.

## Limitations connues

- La clé API est stockée en clair dans `localStorage` (voir plus haut) —
  compromis accepté pour contourner le CORS bloquant sur la vérification de
  session.
- Les événements de navigation Jakartowns (`position`, `rotation`, `tilt`,
  `fov`) sont dispatchés sur `window`, pas scopés par instance : deux
  widgets Jakartowns simultanés sur la même page recevraient les
  événements l'un de l'autre. Limitation de la librairie Jakartowns
  elle-même, pas quelque chose qu'on peut corriger côté widget.
- Le panneau flottant est limité aux bords du widget (pas de "vrai" mode
  Picture-in-Picture qui sortirait le panorama de la fenêtre du navigateur)
  — voir "Pistes futures" ci-dessous.

## Pistes futures (hors scope actuel)

- **Picture-in-Picture réel** (faire sortir le panneau de la fenêtre du
  navigateur, pas seulement le déplacer dans les limites du widget) : l'API
  `documentPictureInPicture` du navigateur (Chrome/Edge) le permettrait,
  mais elle déplace réellement le nœud DOM dans un autre `document` — un
  risque concret de perte du contexte WebGL du canvas Jakartowns au passage.
  Pas tenté dans cette itération pour cette raison ; à explorer séparément
  si le besoin se confirme.
- Publier une **Message Action** (`publishMessages` dans `manifest.json`)
  quand la position Jakartowns change, pour que d'autres widgets de la page
  (pas seulement la carte liée) puissent réagir sans couplage direct.
