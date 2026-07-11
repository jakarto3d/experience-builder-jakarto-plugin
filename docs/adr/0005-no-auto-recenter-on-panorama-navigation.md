# 0005 — No automatic map recentering during panorama navigation

- Date: 2026-07-10
- Status: Accepted (supersedes an earlier bidirectional-sync approach)

## Context

An earlier iteration synced navigation in both directions: a map click moved
the panorama, and moving/rotating inside the panorama called `view.goTo(...)`
on the linked map (via a `useSpatialSync` hook with a 300ms debounce ported
from the Vue prototype's `useSpatialSync` composable, to avoid a
map → Jakartowns → map feedback loop). In practice, recentering the map on
every panorama navigation was judged too intrusive — it fights the user's own
control of the map view, especially during continuous movement inside the
panorama.

## Decision

The map no longer recenters automatically when the panorama's image or
position changes. Only a position/orientation indicator on the map updates
(see [`../specs/interaction-behavior.md`](../specs/interaction-behavior.md)).
Synchronization stays one-way: map click (or right-click, see
[`../specs/interaction-behavior.md`](../specs/interaction-behavior.md)) →
panorama.

## Consequences

- `useSpatialSync` (and its debounce, which had no remaining purpose once the
  feedback loop was removed) was deleted entirely.
- The user's map viewport is never moved without an explicit action (click).
- The position/orientation indicator (an ArcGIS `GraphicsLayer` +
  `PictureMarkerSymbol`, see
  [`0009-heading-applied-via-symbol-angle.md`](0009-heading-applied-via-symbol-angle.md))
  became the primary way to see where the panorama currently points on the
  map, without moving the map itself.
