# 0009 — Apply heading via PictureMarkerSymbol.angle, not baked into the icon

- Date: 2026-07-10
- Status: Accepted

## Context

The map indicator showing the panorama's position and field of view was
first a plain `SimpleMarkerSymbol` triangle. It was then replaced with a
faithful port of an "Observer Icon" used by another internal Jakarto
component (a gradient dot + gradient field-of-view arc), whose exact
geometry was extracted from that component's compiled output — see
[`../specs/jakartowns-integration.md`](../specs/jakartowns-integration.md).
That icon's original usage elsewhere pre-renders it already rotated to the
current heading, as a raster image, which would mean regenerating the SVG
on every micro-rotation of the panorama (the mouse can fire `rotation`
events very frequently).

## Decision

The generated SVG always points up (North); it never encodes heading.
Heading is applied separately via ArcGIS's `PictureMarkerSymbol.angle`
(degrees clockwise from North), which the SDK natively supports. Only a
(rounded) field-of-view change triggers regenerating the SVG.

## Consequences

- Regenerating the icon's data URL only happens on fov changes, not on every
  pan/rotation tick — avoids unnecessary SVG rebuilds during continuous
  panorama navigation.
- The angle convention (clockwise from North, matching that component's own
  `heading` prop: "0 points up, positive values rotate clockwise") is
  implemented in `jakartownsPanToMarkerAngle` (`widget.tsx`). If the map
  indicator ever appears to point in the wrong direction in a live test,
  inverting the sign in that single function is the fix.
