# 0002 — JS API integration bound directly to the MapView

- Date: 2026-07-10
- Status: Accepted

## Context

The widget must bidirectionally sync an ArcGIS map and a Jakartowns
panorama. Three options existed:

1. **Message Actions** (Experience Builder's decoupled pub/sub) — a good fit
   for generic widget-to-widget interactions, but documented mainly for
   "business" messages (selection, extent change), not for fine-grained
   programmatic access to the `MapView`.
2. **Direct access to the active `MapView`** via `JimuMapViewComponent`
   (`jimu-arcgis`) — the pattern used by Esri's official *Legend* sample
   widget: `useMapWidgetIds` (standard config, chosen via
   `MapWidgetSelector`), the `JimuMapView` received through
   `onActiveViewChange`, then the ArcGIS Maps SDK used directly
   (`view.on('click', …)`, `view.goTo(…)`).
3. **Iframe + Jakartowns URL API**
   (`https://maps.jakarto.com/?lat=…&lng=…`) — simple to embed, but no
   documented channel to listen to navigation *inside* the iframe (no
   `postMessage`) → one-way sync only.

## Decision

Use option 2: `JimuMapViewComponent` + the embedded Jakartowns JavaScript API
(`window.jakartowns.app.create_jakartowns(...)`), listening to the global
`position`/`rotation`/`tilt`/`fov` events dispatched on `window` (see
[`../specs/jakartowns-integration.md`](../specs/jakartowns-integration.md)).
Direct port of what `services/arcgis.js` already does in the Vue prototype,
without introducing a message layer.

## Consequences

- Full, direct programmatic control over both the `MapView` and the
  Jakartowns viewer.
- The URL API (option 3) is still used, but as a complement rather than a
  replacement: the "Open in Jakartowns ↗" button works independently of the
  embedded JS API's auth state, as a fallback if the embedded integration
  gets blocked by a cross-site policy on the host portal (see
  [`0004-cache-api-key-in-localstorage.md`](0004-cache-api-key-in-localstorage.md)).
- Message Actions (option 1) remain a possible future extension (e.g.
  publishing a "Jakartowns position changed" message consumable by other
  widgets), not implemented.
