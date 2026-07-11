# Experience Builder Widget — Jakartowns Viewer

Custom widget that displays the **Jakartowns** panorama in a floating
panel, synced with an ArcGIS Experience Builder **Map** widget.

## Status

Tested end-to-end in a real ArcGIS Experience Builder Developer Edition:
authentication, panorama rendering, and bidirectional sync with the map all
work. See [`docs/`](../../docs/README.md) at the repo root for architecture
decisions (ADR) and the widget's up-to-date specs, and
[`docs/known-issues.md`](../../docs/known-issues.md) for the current list
of points still to verify (authentication behavior on the real portal
domain, right-click conflicts with other widgets, floating panel at
reduced size, etc.).

## Installing in an ArcGIS Experience Builder Developer Edition

This folder is **not** a standalone buildable project: it must be copied
into the web extension repo of an existing Developer Edition installation.

> **Useful video for installation**: [Set up ArcGIS Experience Builder Developer Edition](https://www.youtube.com/watch?v=YLBxBio96a8)
> — the first 20 minutes in particular were used to set up the local
> environment (also works on Linux, not just Windows). Follow the video's
> steps in order, without skipping any.
>
> For the video's OAuth step: use an existing ArcGIS Online account (here,
> `https://jakarto.maps.arcgis.com/`) rather than creating a new one, and
> choose the **"OAuth 2.0 credentials - For user authentication"** type for
> the application credentials.

1. Download/install ArcGIS Experience Builder Developer Edition (see the
   official Esri documentation: https://developers.arcgis.com/experience-builder/guide/getting-started-widget/).
2. Copy this entire folder (`Jakartowns/`) into:
   ```
   <exb-installation>/client/your-extensions/widgets/Jakartowns/
   ```
3. From `<exb-installation>/client`, run `npm start` (restart the dev
   server if a `manifest.json`/`config.json` changed — only
   `.ts`/`.tsx`/`.css` files are hot-reloaded).
   If `npm start` fails with an error like `Cannot find module
   'tinyglobby'`, force the Node version with
   [fnm](https://github.com/Schniz/fnm): `fnm exec --using v20.20.2 npm run start`.
4. Open the local ExB builder, add the **Jakartowns Viewer** widget to a
   page that already contains a **Map** widget.
5. In the widget settings, select the Map widget to bind to (`Linked map`).

## Usage

- A visitor must provide their own Jakarto API key (obtainable from
  https://solutions.jakarto.com/profile) — product decision: no shared
  default key. This key is cached in the browser's `localStorage` after a
  successful login, to avoid re-entering it on every visit (the session
  verification endpoint is blocked by CORS from most origins, so it can't
  be relied on to detect an already-active session). Accepted trade-off:
  the key is stored in plain text on the browser side, not encrypted.
- The panorama lives in a **floating panel** above the map:
  - Collapsible/expandable via the chevron button in the title bar.
  - Movable by dragging its title bar (constrained to the widget's edges).
- Two ways to pick a location on the linked map:
  - **Picking mode**: click the "Click on map" button, then click on the
    map — automatically disarms itself after use (avoids every click on
    the map, including ones meant for other tools, moving the panorama).
  - **Right-click** on the map: works at any time, without arming anything.
- The **date of the currently displayed image** is shown as an overlay on
  the panorama. If several captures exist at the same location (multipass),
  a list of dates appears to switch between them.
- The **"Open in Jakartowns ↗"** button opens `maps.jakarto.com` in a new
  tab on **the exact image currently displayed** (via its technical
  identifier, not just lat/lng) — also serves as a fallback if the embedded
  integration fails to authenticate correctly.

## Known limitations and future directions

Accepted decisions and trade-offs (plain-text API key in `localStorage`,
global Jakartowns events on `window`, no real Picture-in-Picture, no
published Message Action): see [`../../docs/adr/`](../../docs/README.md)
for the detail of each decision, and
[`../../docs/known-issues.md`](../../docs/known-issues.md) for what still
needs to be verified in a real environment.
