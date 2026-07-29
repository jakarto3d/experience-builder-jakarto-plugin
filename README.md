# Jakarto × ArcGIS Experience Builder

[![Release](https://github.com/jakarto3d/experience-builder-jakarto-plugin/actions/workflows/release.yml/badge.svg)](https://github.com/jakarto3d/experience-builder-jakarto-plugin/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/jakarto3d/experience-builder-jakarto-plugin)](https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/latest)

Custom widget for **ArcGIS Experience Builder** that displays the
**Jakartowns** panorama in sync with an ArcGIS map, directly from an ArcGIS
experience.

## Quick Start - Plugin View

<img width="1920" height="942" alt="image" src="https://github.com/user-attachments/assets/820f0c4e-a227-47f9-a3fd-2c894e478d85" />

## Quick Start - Installation

https://github.com/user-attachments/assets/e7454dcd-1b93-427d-a3e5-7b9b7492a65e

## Quick Start - Plugin Usage

https://github.com/user-attachments/assets/70f4d0de-6908-4cd3-8feb-fb53c5a7090c



## Repository contents

| Folder | Role |
|---|---|
| [`widgets/Jakartowns/`](widgets/Jakartowns/) | The Experience Builder widget under development (main deliverable). |
| [`docs/`](docs/) | Architecture decisions (ADR) and widget specifications. |

## Status

See [`widgets/Jakartowns/README.md`](widgets/Jakartowns/README.md) for the
widget's status and install/test instructions in an ArcGIS Experience
Builder Developer Edition, and
[`docs/known-issues.md`](docs/known-issues.md) for the points still to
verify in a real environment.

## Releasing

Recipes live in the [`justfile`](justfile) (`just --list`):

| Command | What it does |
|---|---|
| `just check` | Runs the same tests/typechecks CI runs. |
| `just build-release [tag]` | Builds both release zips into `dist-release/`, exactly as the release workflow does — nothing is tagged or published. |
| `just build-release-source [tag]` | Source-only zip; skips the Experience Builder SDK download entirely. |
| `just bump-version [part]` | Bumps the version, tags, and pushes — the tag is what publishes a release. |

Rehearse with `just build-release`, check what lands in `dist-release/`, then
`just bump-version`. The first build downloads and installs the Experience
Builder SDK into `.exb-cache/` (~1.2 GB, gitignored); later builds reuse it and
take seconds. The portal build needs Node 20.x — the recipe switches to it via
[fnm](https://github.com/Schniz/fnm) if that isn't the default.

The workflow can also be rehearsed on a real runner (Actions tab → Release →
Run workflow), which builds and uploads both zips as run artifacts without
publishing a release. See
[ADR-0016](docs/adr/0016-rehearsable-release-build.md).

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

Thanks also to **Esri**: Jakarto is an Esri partner, which gave us access to
ArcGIS Experience Builder to build and test this plugin throughout its
development.
