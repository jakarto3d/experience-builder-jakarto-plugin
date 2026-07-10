# Jakarto × ArcGIS Experience Builder

Widget custom pour **ArcGIS Experience Builder** permettant de consulter le
panorama **Jakartowns** en synchronisation avec une carte ArcGIS, directement
depuis une expérience ArcGIS (ex. `sig.mascouche.ca`).

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| [`widgets/jakartowns-viewer/`](widgets/jakartowns-viewer/) | Le widget Experience Builder en cours de développement (livrable principal). |
| [`esri_js_sdk_demo/`](esri_js_sdk_demo/) | Prototype Vue autonome antérieur (non-ExB) démontrant la synchronisation carte ↔ panorama. Gardé comme référence de logique métier, pas comme code à déployer tel quel. |
| [`docs/`](docs/) | Notes de recherche et journal d'avancement. |

## État d'avancement

Voir [`docs/progress.md`](docs/progress.md) pour le journal détaillé, et
[`widgets/jakartowns-viewer/README.md`](widgets/jakartowns-viewer/README.md)
pour l'état du widget et les instructions d'installation/test dans une
ArcGIS Experience Builder Developer Edition.

## Contexte

Voir [`docs/research-experience-builder.md`](docs/research-experience-builder.md)
et [`docs/research-jakartowns-api.md`](docs/research-jakartowns-api.md) pour
les recherches qui fondent les choix d'architecture.
