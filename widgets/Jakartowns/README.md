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

## Deploying to an ArcGIS Enterprise portal

Registering this widget as a custom widget resource in a real ArcGIS
Enterprise portal (as opposed to running it locally via `npm start` above)
requires the **built** widget (`dist/`), not the source. Each
[GitHub release](../../../../releases) publishes two zips for this reason:

- `Jakartowns-<tag>.zip` — source only, for copying into
  `client/your-extensions/widgets/` as described above.
- `Jakartowns-<tag>-portal.zip` — built against the ArcGIS Experience
  Builder SDK version declared in `manifest.json`'s `exbVersion`; this is
  the one to hand to whoever registers the custom widget on the portal (see
  [ADR-0015](../../docs/adr/0015-automate-portal-ready-release-build.md)
  for how it's produced).

## Knowing when to update

A portal never learns on its own that a new version was published — the zip
was uploaded by hand and stays at that version. So the widget says it
itself: opening its **settings panel in the builder** shows a **"Version du
widget"** section with the installed version and, when a newer release
exists, the version to get and a link to its release page. From there, the
procedure is the one above: download `Jakartowns-v<version>-portal.zip` and
replace the custom widget's file in the portal.

The check is builder-side only (nothing is requested from the published
experience), anonymous, cached 24 hours, and silent if it fails: a portal
with no outbound access to `api.github.com` simply shows "mise à jour non
vérifiable" instead of an error. See
[ADR-0017](../../docs/adr/0017-in-builder-update-notification.md).

## Language

The widget — the panel, the login form, the date timeline and the settings
panel — is available in **English and French**, with nothing to install or
configure: by default it follows the language Experience Builder runs in (the
portal user's language). Any English locale (`en`, `en-CA`, …) shows English;
every other locale shows French. Dates follow the same language.

- **Admin:** the settings panel has a **Default language** option —
  *Automatic* (follow Experience Builder, the default), *Français* or
  *English* — saved with the experience.
- **End-user:** the gear button in the panel's title bar has a **Language**
  selector — *Default* (whatever the admin set up), *Français* or *English*.
  The choice is remembered in that browser.

The French labels
quoted elsewhere in this README ("Version du widget", "mise à jour non
vérifiable") read "Widget version" and "Unable to check for updates" in
English. See [ADR-0018](../../docs/adr/0018-built-in-english-translation.md).

## Signing in

Opening the panorama needs a Jakarto API key. Who provides it is the
experience author's choice, in the **Jakarto sign-in** section of the
settings panel ("Connexion Jakarto" in French) — see
[ADR-0019](../../docs/adr/0019-shared-api-key-chosen-by-the-experience-author.md):

- **Personal keys** (the default): each visitor signs in with their own
  Jakarto API key, obtainable from https://solutions.jakarto.com/profile.
  Everyone keeps their own access rights and usage statistics, and the key
  stays with its owner. This is how the widget has always worked.
- **Shared key**: the author enters one API key and the widget signs everyone
  in with it. Visitors have nothing to enter — the panorama opens directly,
  with no login form and no logout button, and they can't switch to a key of
  their own. We recommend the key of a **dedicated Jakarto service account**
  rather than a person's key.

  Before choosing it, know what it costs. The settings panel shows the same
  warning:
  - the widget's settings are saved in the experience's configuration, which
    every visitor's browser downloads: **anyone who can open the experience
    can read the key**;
  - the key gives access to everything the account's licence allows, not only
    this widget, and it can't be restricted to the portal's domain;
  - everyone has the same access, and usage is counted as a single total, so
    misuse is hard to spot;
  - if the experience is **public**, anyone on the Internet can take the key
    and use it. This mode mostly suits experiences reserved for your
    organization.

  The key is saved when the field loses focus or Enter is pressed, and it is
  erased from the configuration if you switch back to personal keys. If it is
  missing or Jakarto doesn't accept it, visitors see a message saying the
  panorama can't be opened and to contact whoever administers the
  experience.

## Usage

- In personal-keys mode, the key a visitor enters is cached in the browser's
  `localStorage` after a successful login, to avoid re-entering it on every
  visit (the session verification endpoint is blocked by CORS from most
  origins, so it can't be relied on to detect an already-active session).
  Accepted trade-off: the key is stored in plain text on the browser side, not
  encrypted. A shared key is never written to `localStorage`.
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
