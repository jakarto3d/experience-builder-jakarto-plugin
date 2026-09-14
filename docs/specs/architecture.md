# Spec — Widget architecture

> Living document: describes the widget's current structure and integration
> points. Unlike the ADRs in `../adr/`, this file is expected to be updated
> as the code changes. Sources: Esri Experience Builder developer docs
> (developers.arcgis.com/experience-builder).

## 1. Widget anatomy

A custom widget is a folder placed inside a **web extension repo**, itself a
subfolder of `client/` in an ArcGIS Experience Builder Developer Edition
installation:

```
client/
└── your-extensions/            (the default web extension repo)
    └── widgets/
        └── Jakartowns/         (this widget — folder name = widget name)
            ├── manifest.json
            ├── config.json
            ├── icon.svg
            └── src/
                ├── config.ts
                ├── runtime/
                │   ├── widget.tsx
                │   ├── widget.css
                │   ├── services/jakarto.ts
                │   ├── lib/observerIcon.ts
                │   └── translations/default.ts
                └── setting/
                    ├── setting.tsx
                    ├── components/UpdateNotice.tsx
                    ├── lib/updateCheck.ts
                    └── translations/default.ts
```

This repo is not an independently buildable project — see
[`../../widgets/Jakartowns/README.md`](../../widgets/Jakartowns/README.md) for
the copy/install procedure into a real Developer Edition (see
[ADR-0001](../adr/0001-scaffold-without-local-dev-edition.md)).

Sources:
- [Getting started with widget development](https://developers.arcgis.com/experience-builder/guide/getting-started-widget/)
- [Create a starter widget](https://developers.arcgis.com/experience-builder/guide/create-a-starter-widget/)

## 2. manifest.json

Fields used: `name`, `type: "widget"`, `version`, `exbVersion`, `author`,
`description`, `translatedLocales`, `defaultSize`. Using the ArcGIS Maps for
JavaScript SDK (and the Map-widget-binding hooks) requires declaring the
`jimu-arcgis` dependency.

Source: [Widget manifest](https://developers.arcgis.com/experience-builder/guide/widget-manifest/)

`config.json` holds the default values for `src/config.ts`'s `Config`
interface (currently just `fallbackLatitude`/`fallbackLongitude`). Without
this file, Experience Builder marks the widget `hasConfig: false` and
`props.config` stays undefined, which crashes the settings panel — see
`src/config.ts` and [ADR-0001](../adr/0001-scaffold-without-local-dev-edition.md).

## 3. Binding to a Map widget: `JimuMapViewComponent`

The widget declares `useMapWidgetIds` (standard Experience Builder config,
selected by the user via `MapWidgetSelector` in `setting.tsx`) and renders
`<JimuMapViewComponent useMapWidgetId={useMapWidgetIds[0]} onActiveViewChange={...} />`
to receive the linked map's active `JimuMapView`. From there, the widget uses
the ArcGIS Maps SDK directly (`view.on('click', …)`, `view.container`
DOM events for right-click, `loadArcGISJSAPIModules` to dynamically load
`esri/layers/GraphicsLayer` and `esri/Graphic`).

See [ADR-0002](../adr/0002-js-api-integration-via-jimumapviewcomponent.md)
for why this pattern was chosen over Message Actions or an iframe.

## 4. Runtime components

- **`widget.tsx`** — the React component tree: floating panel (drag/resize/
  fold), login form, panorama container, multipass timeline, settings
  popover, and the map-side position/orientation indicator (an ArcGIS
  `GraphicsLayer` with a single repositioned/reoriented `Graphic`, not
  recreated on every update). See
  [`interaction-behavior.md`](interaction-behavior.md).
- **`services/jakarto.ts`** — isolates all Jakartowns integration (auth +
  viewer embed) from the React layer. See
  [`jakartowns-integration.md`](jakartowns-integration.md).
- **`lib/observerIcon.ts`** — generates the map indicator's SVG icon (ported
  from another internal Jakarto component's Observer Icon). See
  [ADR-0009](../adr/0009-heading-applied-via-symbol-angle.md).

## 5. Setting components

- **`setting.tsx`** — the settings panel: the `MapWidgetSelector` binding
  (section 3), the panorama options backed by `config.json`, and the
  "Version du widget" section.
- **`components/UpdateNotice.tsx` + `lib/updateCheck.ts`** — compares
  `props.manifest.version` (injected by the framework) against the latest
  published GitHub release, so whoever installed the widget on a portal
  learns that a newer zip exists. Builder-side only, cached 24 h in
  `localStorage` (`jakartowns-viewer:latestRelease`), and silent on failure
  — see [ADR-0017](../adr/0017-in-builder-update-notification.md).

## 6. Validation limits

Without a local Developer Edition, `jimu-core` / `jimu-ui` / `jimu-arcgis`
cannot be installed as regular npm dependencies. Code here is written to be
syntactically and architecturally consistent with Esri's official samples,
but changes should be verified end-to-end in a real builder before being
considered done — see [`../known-issues.md`](../known-issues.md) for what
hasn't been verified yet.

To narrow that gap, logic that has no actual jimu/ArcGIS dependency (panel
drag/resize/fold geometry, pan-to-marker-angle conversion, date formatting,
multipass timeline derivation, plus the pre-existing `services/jakarto.ts`
and `lib/observerIcon.ts`, and the release-version comparison in
`src/setting/lib/updateCheck.ts`) lives in `src/runtime/lib/`,
`src/runtime/services/` and `src/setting/lib/`, and is covered by real,
passing Jest tests, runnable via `npm test` from the
repo root — no Developer Edition needed. `widget.tsx`/`setting.tsx` stay
untested beyond a `tsc --noEmit` sanity check against ambient jimu stubs
(`npm run widget-check`); their JSX/render tree and jimu/ArcGIS wiring still
require a real Developer Edition to verify. See
[ADR-0011](../adr/0011-extract-pure-logic-for-unit-testing.md).
