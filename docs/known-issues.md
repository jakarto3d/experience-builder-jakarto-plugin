# Known issues / unverified behavior

Items here require a real ArcGIS Experience Builder Developer Edition (and,
for some, the real portal domain) to verify. Move an item out of this list
once it's been confirmed one way or the other — either delete it or turn it
into an ADR if it changes a decision.

- **Auth on the real portal domain**: authentication has only been verified
  from `localhost`. CORS behavior on `account.jakarto.com` might differ once
  the widget is hosted under the real portal domain — see
  [ADR-0004](adr/0004-cache-api-key-in-localstorage.md).
- **Right-click conflicts**: right-click-to-locate (opt-in, see
  [`specs/interaction-behavior.md`](specs/interaction-behavior.md)) hasn't
  been tested alongside other widgets that might already use a right-click
  context menu on the same map.
- **Floating panel at small widget sizes**: not verified that the panel
  (400×390 minimum) stays usable when the widget itself is placed at a
  small size in the page layout.
- **Initial-position timing on re-authentication**: when a position was
  already picked earlier in the session and the user logs out/back in, the
  initial `setPosition()` call is deferred by one animation frame to avoid a
  suspected race with Jakartowns' internal init (see
  [ADR-0008](adr/0008-no-default-panorama-position-on-load.md)). This fix
  is plausible and mirrors an already-confirmed fix for the canvas-resize
  issue, but was not confirmed with 100% certainty against a live instance.
- **Global viewer events**: Jakartowns dispatches `position`/`rotation`/
  `tilt`/`fov` on `window`, not scoped per instance. Two Jakartowns widgets
  on the same page would receive each other's events. This is a limitation
  of the Jakartowns library itself — not fixable from this widget.
- **Vector-tile availability layer**: removed due to a CORS/cookie
  limitation (see [ADR-0006](adr/0006-remove-jakman-availability-layer.md)).
  Would need Jakarto to expose that endpoint with cross-origin support (or a
  proxy) before it could be revisited.
