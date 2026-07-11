# 0006 — Remove the "jakman" panorama-availability layer

- Date: 2026-07-10
- Status: Accepted (reverses a prior decision)

## Context

By analogy with a "jakman" button in another internal Jakarto tool, a layer
was added to show where Jakartowns panoramas exist while picking mode was
active. Investigation showed the underlying data is a vector-tile layer
(`https://maps.jakarto.com/backend/tiles/data/spheres/{z}/{x}/{y}.pbf`,
Mapbox/MapLibre format), which the ArcGIS JS SDK can also consume via
`VectorTileLayer` with a Mapbox GL Style Spec. It was implemented in
`src/runtime/lib/jakmanLayer.ts`.

Tested against the real endpoint: the tile request is redirected to a login
page (`solutions.jakarto.com/login?redirectTo=...`) and blocked by CORS;
ArcGIS's automatic fallback to its own sharing proxy also fails with a 403.
The working hypothesis (consistent with the CORS block already seen on
`/auth`) is that the Jakarto session cookie is `SameSite=Lax/Strict`, so it's
never sent on a cross-site background request from the widget — regardless
of any client-side ArcGIS configuration (request interceptors,
`trustedServers`, etc.). This isn't fixable from the widget side.

## Decision

Remove the jakman layer entirely rather than ship a non-functional feature.
`src/runtime/lib/jakmanLayer.ts` was deleted.

## Consequences

- Picking mode no longer shows where Jakartowns data is available; the user
  must click and see whether a panorama loads.
- If Jakarto ever exposes this tile endpoint with CORS/`SameSite=None`
  support (or a proxy), this could be revisited — the `VectorTileLayer` +
  Mapbox GL style approach explored here would still apply.
