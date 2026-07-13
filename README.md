# Jakarto × ArcGIS Experience Builder

Custom widget for **ArcGIS Experience Builder** that displays the
**Jakartowns** panorama in sync with an ArcGIS map, directly from an ArcGIS
experience.

## Quick started - Installation
https://github.com/user-attachments/assets/e7454dcd-1b93-427d-a3e5-7b9b7492a65e

## Quick started - Plugin Usage
https://github.com/user-attachments/assets/70f4d0de-6908-4cd3-8feb-fb53c5a7090c



## Repository contents

| Folder | Role |
|---|---|
| [`widgets/Jakartowns/`](widgets/Jakartowns/) | The Experience Builder widget under development (main deliverable). |
| [`docs/`](docs/) | Architecture decisions (ADR) and widget specifications. |

## Progress

See [`widgets/Jakartowns/README.md`](widgets/Jakartowns/README.md) for the
widget's status and install/test instructions in an ArcGIS Experience
Builder Developer Edition, and
[`docs/known-issues.md`](docs/known-issues.md) for the points still to
verify in a real environment.

## Context and architecture choices

The technical documentation follows an ADR (Architecture Decision Records) +
living specs approach — see [`docs/README.md`](docs/README.md) for the full
index. In short:

- [`docs/specs/architecture.md`](docs/specs/architecture.md) — widget
  structure and binding to a Map widget.
- [`docs/specs/jakartowns-integration.md`](docs/specs/jakartowns-integration.md) —
  authentication, Jakartowns JS/URL API.
- [`docs/specs/interaction-behavior.md`](docs/specs/interaction-behavior.md) —
  floating panel behavior, picking mode, date timeline.
- [`docs/adr/`](docs/adr/) — architecture decision history (context,
  decision, consequences), including choices that were later reverted.

The detailed day-by-day change history remains available via `git log`
(convention `feat(widget)`/`fix(widget)`/`docs`).

Useful external resource: [Getting started with widget development](https://developers.arcgis.com/experience-builder/guide/getting-started-widget/)
(ArcGIS Experience Builder Developer Guide).

## Acknowledgments

<img src="https://mascouche.ca/storage/app/media/uploaded-files/logo-ville-de-mascouche-2025-noir-95-rgb.png" alt="Ville de Mascouche" width="220">

This widget exists thanks to the **Ville de Mascouche**, who commissioned its
development. Thank you for making it possible.
