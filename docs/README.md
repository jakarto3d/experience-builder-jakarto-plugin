# Documentation

This folder follows an ADR + spec-driven documentation approach:

- **[`adr/`](adr/)** — Architecture Decision Records. Each one captures a
  single decision (context, decision, consequences) at the time it was made.
  ADRs are not edited after the fact to reflect later changes — a decision
  that gets reversed or replaced gets a new ADR that says so and links back
  to the one it supersedes.
- **[`specs/`](specs/)** — living documents describing the widget's current
  architecture and behavior. Unlike ADRs, these are expected to be kept in
  sync with the code as it evolves.
- **[`known-issues.md`](known-issues.md)** — behavior that hasn't been
  verified in a real environment yet, and known library/platform
  limitations that aren't fixable from this widget.

For a plain chronological history of changes (including day-to-day bug
fixes not significant enough to warrant an ADR), use `git log` — commit
messages follow a `feat(widget)`/`fix(widget)`/`docs` convention.

## Index

| Doc | Covers |
|---|---|
| [`specs/architecture.md`](specs/architecture.md) | Widget folder structure, manifest/config, Map-widget binding |
| [`specs/jakartowns-integration.md`](specs/jakartowns-integration.md) | Auth flow, JS API surface, URL API, platform quirks |
| [`specs/interaction-behavior.md`](specs/interaction-behavior.md) | Floating panel, picking mode, timeline, settings |
| [`known-issues.md`](known-issues.md) | Unverified behavior, library limitations |
| [`adr/0001`](adr/0001-scaffold-without-local-dev-edition.md) | Scaffolding without a local Dev Edition |
| [`adr/0002`](adr/0002-js-api-integration-via-jimumapviewcomponent.md) | JS API integration via `JimuMapViewComponent` |
| [`adr/0003`](adr/0003-per-user-api-key-authentication.md) | Per-user API key authentication |
| [`adr/0004`](adr/0004-cache-api-key-in-localstorage.md) | Caching the API key in `localStorage` |
| [`adr/0005`](adr/0005-no-auto-recenter-on-panorama-navigation.md) | No map auto-recenter on panorama navigation |
| [`adr/0006`](adr/0006-remove-jakman-availability-layer.md) | Removing the "jakman" availability layer |
| [`adr/0007`](adr/0007-defer-real-picture-in-picture.md) | Deferring real Picture-in-Picture |
| [`adr/0008`](adr/0008-no-default-panorama-position-on-load.md) | No default panorama position on load |
| [`adr/0009`](adr/0009-heading-applied-via-symbol-angle.md) | Heading via `PictureMarkerSymbol.angle` |
| [`adr/0010`](adr/0010-revert-orientation-preservation-on-image-switch.md) | Reverting orientation preservation on image switch |
| [`adr/0011`](adr/0011-extract-pure-logic-for-unit-testing.md) | Extracting pure logic for unit testing, root-level Jest harness |
