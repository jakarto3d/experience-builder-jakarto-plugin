# Widget Experience Builder — Jakartowns Viewer

Widget custom qui affiche le panorama **Jakartowns** synchronisé avec un
widget **Map** d'ArcGIS Experience Builder : cliquer sur la carte déplace le
panorama, naviguer dans le panorama recentre la carte.

## Statut

MVP fonctionnel *sur le papier* : manifest, liaison à un widget Map,
authentification par clé API Jakarto, embed du viewer, et synchronisation
bidirectionnelle (clic carte → panorama, navigation panorama → carte) sont
tous écrits. **Rien n'a encore été compilé ni testé dans un vrai builder**
(pas de Developer Edition disponible) — voir la checklist de vérification
ci-dessous avant toute mise en production. Voir
[`docs/progress.md`](../../docs/progress.md) à la racine du dépôt pour le
journal détaillé de chaque étape.

### Checklist à vérifier une fois déployé dans un environnement réel

- [ ] Le widget compile sans erreur TypeScript une fois copié dans
      `client/your-extensions/widgets/` (types `jimu-core`/`jimu-arcgis`/`jimu-ui`
      réels, non vérifiables ici).
- [ ] Le cookie de session Jakarto (partitionné) survit bien au contexte
      d'un widget hébergé sous le domaine du portail (`sig.mascouche.ca`) —
      risque de blocage cross-site selon la politique du navigateur.
- [ ] Le clic sur la carte liée n'entre pas en conflit avec d'autres widgets
      qui écoutent aussi les clics sur la même `MapView` (ex. widget de
      sélection d'entités).
- [ ] Le `goTo` déclenché par les événements `position` de Jakartowns reste
      fluide si l'utilisateur navigue en continu dans le panorama (l'anti-rebond
      actuel est fixé à 300 ms, à ajuster si besoin).
- [ ] Le formulaire de connexion s'affiche/se comporte correctement dans les
      tailles réduites du widget (voir `defaultSize` dans `manifest.json`).

## Installation dans une ArcGIS Experience Builder Developer Edition

Ce dossier n'est **pas** un projet buildable en autonomie : il doit être
copié dans le web extension repo d'une installation Developer Edition
existante.

1. Télécharger/installer ArcGIS Experience Builder Developer Edition (voir la
   documentation Esri officielle : https://developers.arcgis.com/experience-builder/guide/getting-started-widget/).
2. Copier ce dossier entier (`jakartowns-viewer/`) dans :
   ```
   <installation-exb>/client/your-extensions/widgets/jakartowns-viewer/
   ```
3. Depuis `<installation-exb>/client`, lancer `npm start` (ou redémarrer le
   serveur de dev s'il tournait déjà — les nouveaux widgets ne sont détectés
   qu'au démarrage).
4. Ouvrir le builder ExB local, ajouter le widget **Jakartowns Viewer** à une
   page contenant déjà un widget **Map**.
5. Dans les réglages du widget, sélectionner le widget Map à lier
   (`Carte liée`).

## Utilisation

- Un visiteur doit renseigner sa propre clé d'API Jakarto (récupérable sur
  https://solutions.jakarto.com/profile) pour afficher le panorama —
  décision produit : pas de clé partagée par défaut (voir
  `docs/progress.md`, entrée du 2026-07-10).
- Une fois connecté, cliquer sur la carte liée déplace le panorama
  Jakartowns à cet endroit ; naviguer dans le panorama recentre la carte.
- Un lien **"Ouvrir dans Jakartowns ↗"** est toujours visible dès qu'une
  carte est liée, connexion ou non : il ouvre `maps.jakarto.com` dans un
  nouvel onglet, à la dernière position connue (via l'API URL, pas l'API
  JS). Ce lien ne dépend pas de la connexion à l'intégration embarquée —
  c'est un chemin de repli utile si l'auth cross-site pose problème dans le
  contexte du portail.

## Limitations connues (à vérifier en environnement réel)

- Code non compilé/testé localement (pas de Developer Edition disponible au
  moment de l'écriture — `jimu-core`/`jimu-arcgis`/`jimu-ui` ne sont
  résolubles que depuis le build system d'une vraie installation ExB).
- Le flux d'authentification Jakartowns pose un cookie de session
  **partitionné** sur `account.jakarto.com` / `maps.jakarto.com` — son
  comportement dans le contexte d'un widget hébergé sous un domaine
  ArcGIS (ex. `sig.mascouche.ca`) n'a pas été vérifié. Premier test à faire
  une fois déployé.

## Pistes futures (hors scope MVP)

- Publier une **Message Action** (`publishMessages` dans `manifest.json`)
  quand la position Jakartowns change, pour que d'autres widgets de la page
  (pas seulement la carte liée) puissent réagir sans couplage direct.
- Support de la sélection d'image/date via l'événement `position` du
  viewer Jakartowns (`multipassAtLocation`), pour choisir entre plusieurs
  captures disponibles au même endroit.
