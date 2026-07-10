# Recherche — Widgets custom ArcGIS Experience Builder

Notes de recherche (2026-07-10) qui fondent les choix d'implémentation du widget
`widgets/jakartowns-viewer`. Sources : documentation officielle Esri Developer
(developers.arcgis.com/experience-builder) et doc.arcgis.com.

## 1. Anatomie d'un widget custom

Un widget custom est un dossier placé dans un **web extension repo**, lui-même
un sous-dossier de `client/` dans une installation d'**ArcGIS Experience
Builder Developer Edition** :

```
client/
└── your-extensions/            (le web extension repo fourni par défaut)
    └── widgets/
        └── jakartowns-viewer/  (notre widget — nom = nom du dossier)
            ├── manifest.json
            ├── icon.svg
            └── src/
                ├── config.ts
                ├── runtime/
                │   └── widget.tsx
                └── setting/
                    └── setting.tsx
```

Nous n'avons pas de Developer Edition installée localement (confirmé avec
l'utilisateur) : ce dépôt scaffold donc le contenu du dossier
`jakartowns-viewer/` tel qu'il devra être copié-collé dans
`client/your-extensions/widgets/` d'une future installation. Voir
[widgets/jakartowns-viewer/README.md](../widgets/jakartowns-viewer/README.md)
pour la procédure d'installation/test.

Sources :
- [Getting started with widget development](https://developers.arcgis.com/experience-builder/guide/getting-started-widget/)
- [Create a starter widget](https://developers.arcgis.com/experience-builder/guide/create-a-starter-widget/)

## 2. manifest.json

Champs utilisés : `name`, `type: "widget"`, `version`, `exbVersion`, `author`,
`description`, `translatedLocales`, `defaultSize`. Pour utiliser le SDK
ArcGIS Maps for JavaScript (et les hooks de liaison à un widget Map) il faut
déclarer la dépendance `jimu-arcgis`.

Source : [Widget manifest](https://developers.arcgis.com/experience-builder/guide/widget-manifest/)

## 3. Se lier à un widget Map existant : `JimuMapViewComponent`

Deux mécanismes existent pour faire interagir un widget custom avec la carte :

1. **Message Actions** (pub/sub découplé) — un widget déclare les triggers
   qu'il émet (`getActionsByGroup`) et gère les actions reçues
   (`onExecuteMessageAction`). Bien adapté pour des interactions génériques
   (ex. synchroniser deux cartes), mais plus indirect et documenté surtout
   pour des messages "métier" (sélection d'enregistrements, changement
   d'étendue) plutôt que pour un accès programmatique fin à la `MapView`.
   Source : [Add actions to widgets](https://developers.arcgis.com/experience-builder/guide/action-triggers/)

2. **Accès direct à la `MapView` active** via `JimuMapViewComponent`
   (package `jimu-arcgis`) — c'est le pattern utilisé par le widget
   d'exemple officiel **Legend** : le widget déclare
   `useMapWidgetIds` (config standard, choisie par l'utilisateur dans le
   panneau de réglages via `MapWidgetSelector`), reçoit la `JimuMapView`
   correspondante via `onActiveViewChange`, et peut alors utiliser
   directement l'API ArcGIS Maps SDK (`view.on('click', …)`, `view.goTo(…)`,
   etc.) — exactement comme le fait `services/arcgis.js` du prototype Vue
   (`esri_js_sdk_demo`).
   Source : [Legend widget (js-api-widget sample)](https://developers.arcgis.com/experience-builder/sample-code/widgets/js-api-widget/)

**Décision** : on utilise l'option 2. Elle donne un contrôle programmatique
complet et direct, équivalent à ce que fait déjà `services/arcgis.js` dans le
prototype — portage plus direct, pas de couche de messages à define.
Les Message Actions restent une extension possible plus tard (ex. publier un
message "position Jakartowns changée" consommable par d'autres widgets),
documentée comme piste future dans le README du widget mais pas implémentée
au MVP.

## 4. Limites de validation

Sans Developer Edition locale, `jimu-core` / `jimu-ui` / `jimu-arcgis` ne sont
pas installables comme dépendances npm classiques : ils sont fournis par le
build system interne du dossier `client/` d'Experience Builder. Le code de
`widgets/jakartowns-viewer/src` est donc écrit pour être syntaxiquement et
architecturalement conforme aux exemples officiels, mais **n'a pas pu être
compilé ni testé dans un vrai builder**. Voir la section "Limitations" du
README du widget pour la checklist de vérification à faire une fois déposé
dans un environnement réel.
