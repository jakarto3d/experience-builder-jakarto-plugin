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
- **Update notice rendering**: the "Version du widget" section
  ([ADR-0017](adr/0017-in-builder-update-notification.md)) type-checks
  against the real jimu types and builds into the portal bundle, but its
  layout in the settings panel (the `Alert` and the link inside a
  `SettingRow flow="wrap"`) hasn't been looked at in a running builder yet.
  Its "update available" state can only be seen once a release newer than
  the installed version exists — until then it renders "À jour".
- **English UI and language choice**: end-user pick, then the admin's
  "Default language", then `props.locale`
  ([ADR-0018](adr/0018-built-in-english-translation.md)). The pure selection,
  the two string sets, the stored setting and the portal build are checked by
  tests and by `just build-release`, and the popover's layout was rendered
  with the widget's CSS, but none of it has been looked at in a running
  builder — in particular that `props.locale` carries the portal user's
  language there (e.g. `en-ca`) rather than something else, and how the
  jimu-ui `Select` for "Default language" lays out in the settings panel.
  Not covered: the embedded Jakartowns viewer's own UI, and the French
  tutorial on docs.jakarto.com.
- **Shared API key**
  ([ADR-0019](adr/0019-shared-api-key-chosen-by-the-experience-author.md)):
  the mode switch, the key being kept out of `localStorage`, the missing/failed
  messages and the pure `resolveAuthSetup` are checked by tests, the portal
  build and a type-check against the real jimu types, but none of it has been
  looked at in a running builder or against a live portal. In particular:
  how the "Jakarto sign-in" section lays out (the `Select`, the masked
  `TextInput` saving on blur/Enter, the warning `Alert` and its list); and
  what the service account's session cookie does to a visitor's own Jakarto
  session in the same browser, and to "Open in Jakartowns" (expected: it
  replaces it, and the link opens as the service account).
- **Vector-tile availability layer**: removed due to a CORS/cookie
  limitation (see [ADR-0006](adr/0006-remove-jakman-availability-layer.md)).
  Would need Jakarto to expose that endpoint with cross-origin support (or a
  proxy) before it could be revisited.
