# Spec — UI / interaction behavior

> Living document: describes the widget's current UX. Update this file when
> behavior changes; use `../adr/` only for the decisions behind it.

## Floating panel

- Renders as a floating panel (`position: absolute`) over the linked map,
  occupying the widget's full available space by default (minus a 12px
  margin) until the user drags or resizes it — after that, the user's
  chosen size/position is respected even if the widget is resized.
- **Fold/unfold**: chevron button in the title bar. Folded, the panel
  shrinks to just its title bar (no inline height forced, so it doesn't
  leave an empty gap) while the panorama container stays mounted (hidden via
  CSS, not unmounted — see
  [`jakartowns-integration.md`](jakartowns-integration.md)).
- **Drag**: by the title bar, constrained to the widget's own bounds.
- **Resize**: 8 handles (4 edges + 4 corners), minimum 400×390px.
- The widget's outer container has `pointer-events: none` so empty space
  around the panel doesn't block clicks to the map underneath; the panel
  itself re-enables `pointer-events: auto`. When this widget is nested
  *inside* a Map widget (e.g. like a zoom control), Experience Builder forces
  `pointer-events: auto` back onto wrapper elements it injects around every
  child widget of the Map — neutralized with a scoped `:has()` selector in
  `widget.css` that only targets ancestors containing this specific widget,
  so other Map-nested widgets (zoom, search, home) are unaffected.

## Pointing at a location

Two ways to point the panorama at a map location:

- **Picking mode**: a dedicated title-bar button arms a one-off left click;
  the next map click locates the panorama and the mode disarms itself
  automatically.
- **Right-click**: works at any time without arming anything, but is
  **disabled by default** — enabled per-user via the settings popover
  (gear icon), since right-click can conflict with a host application's own
  context menu. The setting persists in `localStorage`
  (`jakartowns-viewer:settings`).

Both relocate the viewer to the nearest available panorama sphere near the
clicked point (not necessarily exactly on it); once that new position is
confirmed, the heading is turned to face the point that was actually
clicked, and reasserted for up to 800ms against the Jakartowns API's own
internal auto-rotation if needed — see
[ADR-0012](../adr/0012-heading-towards-clicked-point-after-locate.md) and
[ADR-0014](../adr/0014-reassert-heading-against-repeated-clobbers.md). Past
that short window, it doesn't keep re-aiming at that point as the user
navigates further inside the panorama.

Navigating inside the panorama does **not** move the map back — see
[ADR-0005](../adr/0005-no-auto-recenter-on-panorama-navigation.md). Instead,
a position/orientation indicator on the map updates on every `position` /
`rotation` / `fov` event (an ArcGIS `GraphicsLayer` with a single
repositioned/reoriented `Graphic` — see
[ADR-0009](../adr/0009-heading-applied-via-symbol-angle.md)).

## Multipass date timeline

- Shows a horizontally scrollable strip of date chips at the bottom of the
  panorama, one per image available at the current location
  (`multipassAtLocation`). Always shows at least the current image's date,
  even when there's only one.
- Left/right arrow buttons scroll the strip; disabled when there's nothing
  to scroll.
- Clicking a chip calls `setImage(imageId)` on the viewer. The current pan
  is carried forward to the new image once its position is confirmed (and
  reasserted for up to 800ms against the sphere's own auto-rotation if
  needed), instead of resetting to the sphere's default heading — see
  [ADR-0013](../adr/0013-reimplement-orientation-preservation-on-image-switch.md)
  and [ADR-0014](../adr/0014-reassert-heading-against-repeated-clobbers.md).
  An approximation (exact for a subject far from both capture points,
  which is the common case), not a guaranteed identical frame.

## Authentication

- Login form (API key) shown until authenticated; see
  [ADR-0003](../adr/0003-per-user-api-key-authentication.md) and
  [ADR-0004](../adr/0004-cache-api-key-in-localstorage.md).
- Logout button (title bar) tears down the viewer and clears the cached key.

## "Open in Jakartowns" button

Always visible once a map is linked, regardless of the embedded API's auth
state. Opens `buildJakartownsUrl(...)` in a new tab, using the last known
viewer state (or the last clicked position, or
`config.fallbackLatitude/Longitude` as a last resort) — see
[`jakartowns-integration.md`](jakartowns-integration.md#5-url-api-fallback--open-in-jakartowns-button).
Disabled until an image is loaded.

## Not implemented

- Real Picture-in-Picture (panel leaving the browser window) — see
  [ADR-0007](../adr/0007-defer-real-picture-in-picture.md).
- Message Actions (publishing panorama position changes to other widgets) —
  see [ADR-0002](../adr/0002-js-api-integration-via-jimumapviewcomponent.md).
