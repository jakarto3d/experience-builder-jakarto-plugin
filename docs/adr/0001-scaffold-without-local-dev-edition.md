# 0001 — Scaffold the widget in this repo without a local Dev Edition

- Date: 2026-07-10
- Status: Accepted

## Context

The starting point was a standalone Vue prototype (`esri_js_sdk_demo`) that
demonstrates ArcGIS map ↔ Jakartowns panorama synchronization, but is not an
Experience Builder widget (no `manifest.json`, no `jimu-core`, standalone Vue
structure). No ArcGIS Experience Builder Developer Edition installation was
available locally at project start. `jimu-core` / `jimu-ui` / `jimu-arcgis`
are not installable as regular npm dependencies — they're provided by the
internal build system of a Developer Edition's `client/` folder.

## Decision

Scaffold the widget in this repo (`widgets/Jakartowns/`), following the
structure and APIs documented by Esri as closely as possible (see
[`../specs/architecture.md`](../specs/architecture.md)), for later copy into
`client/your-extensions/widgets/` of a real Developer Edition installation —
rather than waiting for access to a test environment before starting.

## Consequences

- Part of the code was written without being compilable or testable before
  the first real Developer Edition access. The first real test surfaced four
  blocking bugs at once (see Git history around 2026-07-10): missing
  `config.json`, `useMapWidgetIds` passed where `useMapWidgetId` was
  expected, a nonexistent `viewer.on()` call, and an `#app` id collision.
- This repo is not an independently buildable project; see
  [`../../widgets/Jakartowns/README.md`](../../widgets/Jakartowns/README.md)
  for the install procedure into a Developer Edition.
