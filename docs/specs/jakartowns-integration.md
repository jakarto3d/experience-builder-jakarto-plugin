# Spec — Jakartowns integration

> Living document: describes the current authentication flow and API surface
> used by `src/runtime/services/jakarto.ts`. Sources: official Jakarto
> developer docs (docs.jakarto.com) and a reference integration gist.

## 1. Authentication flow

1. The user provides their Jakarto API key (retrievable at
   `https://solutions.jakarto.com/profile`) — see
   [ADR-0003](../adr/0003-per-user-api-key-authentication.md).
2. It's exchanged for a session cookie via
   `POST https://account.jakarto.com/users/trade-api-key`
   (`credentials: 'include'`, `mode: 'cors'`). The cookie is expected to be
   partitioned/`SameSite`-friendly, since the widget runs on a domain other
   than `jakarto.com`.
3. The script `https://maps.jakarto.com/api/v1.js` is loaded (authorized by
   the session cookie), exposing `window.jakartowns`.
4. The viewer is created via
   `window.jakartowns.app.create_jakartowns(selector, options, callback)`.
5. Logout: `POST https://account.jakarto.com/users/logout`.

The API key is cached in `localStorage` to skip re-entering it on every page
load — see [ADR-0004](../adr/0004-cache-api-key-in-localstorage.md). The
older session-check endpoint (`GET account.jakarto.com/auth`) is blocked by
CORS from most embedding origins and is not used to detect an active
session.

## 2. Viewer creation options

```js
window.jakartowns.app.create_jakartowns(
  '#selector',
  {
    headerEnabled: false,   // the widget shows its own "Jakartowns" title bar
    minimapEnabled: false,  // the linked ArcGIS map already acts as a minimap
    compassEnabled: true    // still useful for orienting inside the panorama
  },
  (viewer) => { /* ... */ }
)
```

## 3. Viewer methods used

| Method | Role |
|---|---|
| `setPosition({ latitude, longitude }, options?)` | Moves the panoramic view |
| `setImage(uid)` | Displays a specific panorama by technical id |
| `setTilt(value)` | Vertical tilt |
| `setPan(value)` | Horizontal rotation |
| `setFov(value)` | Field of view |
| `setMarkers(geojson)` | Projects points of interest onto panoramas (not currently used by this widget) |

## 4. Viewer events

The viewer does **not** expose an `.on(...)` method — it dispatches
navigation events on `window` as `CustomEvent`s (confirmed by reading a
production Jakarto app's actual code, which listens the same way).

| Event | Fires on | Detail |
|---|---|---|
| `position` | Position change | `latitude`, `longitude`, `currentSphereInfo.properties.{image_id,date}`, `multipassAtLocation` (images available at this location) |
| `rotation` | Horizontal rotation change (pan) | number (radians) |
| `tilt` | Vertical tilt change | number |
| `fov` | Field-of-view change | number (degrees) |

**These events are global, not scoped per widget instance** — two
Jakartowns widgets on the same page would receive each other's events. This
is a limitation of the Jakartowns library itself, not something fixable from
this widget (see [`../known-issues.md`](../known-issues.md)).

`pan`/`tilt`/`fov` are read via `getViewState()` (used to build the "Open in
Jakartowns" URL); they intentionally do not trigger a React re-render on
every tick, since the mouse can fire `rotation` very frequently. A separate,
lightweight `onOrientationChange` callback exists specifically to drive the
map's orientation indicator without that churn — see
[ADR-0009](../adr/0009-heading-applied-via-symbol-angle.md). `setPan` is
also written in reaction to the `position` event that follows a
picking-mode/right-click locate or a multipass image switch, then
reasserted against every subsequent `rotation` event for up to 800ms, to
override the auto-rotation the Jakartowns API applies internally on
`setPosition` and `setImage` alike (both commit the same `updatePosition`
mutation internally, and exactly when its effect settles relative to a
single corrective call proved unreliable in practice) — see
[ADR-0012](../adr/0012-heading-towards-clicked-point-after-locate.md),
[ADR-0013](../adr/0013-reimplement-orientation-preservation-on-image-switch.md)
and [ADR-0014](../adr/0014-reassert-heading-against-repeated-clobbers.md).

## 5. URL API (fallback / "Open in Jakartowns" button)

```
https://maps.jakarto.com/?lat={latitude}&lng={longitude}&pan={pan}&tilt={tilt}&fov={fov}&year={year}
```

Prioritizes `uid` (exact image id) over `lat`/`lng` as soon as an image is
loaded, to reopen the exact same capture rather than a nearby but different
one — matching what a production Jakarto app does for its own "open"
button. Not used for the main embedded integration (see
[ADR-0002](../adr/0002-js-api-integration-via-jimumapviewcomponent.md)), only
as an independent fallback link that works even if the embedded JS API is
blocked by the host portal's cross-site policy.

## 6. Practical constraints observed

- **Canvas sizing**: Jakartowns only resizes its canvas in reaction to
  `window`'s native `resize` event, not a `ResizeObserver` on its own
  container. `initializeViewer` forces a `resize` dispatch after mount (via
  `requestAnimationFrame`) and on every real container size change (via a
  `ResizeObserver` that re-dispatches `resize`).
- **DOM id collision**: Jakartowns mounts its internal app in a
  hardcoded `id="app"` div. Experience Builder has its own `#app` root
  elsewhere on the page with a global `display: none` rule that also lands
  on Jakartowns' nested div due to id-selector collision. Neutralized in
  `widget.css` with a more specific selector
  (`.jakartowns-viewer-panorama #app`).
- **Folding the panel** hides the panorama container via CSS
  (`display: none`) rather than unmounting it from the JSX — unmounting and
  remounting the WebGL canvas breaks it, since Jakartowns doesn't recreate it
  on its own in a new empty div.
