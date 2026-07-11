# 0007 — Defer real Picture-in-Picture

- Date: 2026-07-10
- Status: Accepted

## Context

A true Picture-in-Picture mode was requested: the panorama panel would leave
the browser window entirely, rather than just moving within the widget's
bounds. The browser's `documentPictureInPicture` API (Chrome/Edge) could do
this, but it works by moving the DOM node into a different `document` — a
concrete risk of losing the Jakartowns canvas's WebGL context during that
transfer, with behavior that isn't guaranteed and varies by browser.

## Decision

Ship a floating panel that can be dragged and resized *within* the widget's
own bounds (covers the main ask: a movable, foldable panel) instead of
attempting real Picture-in-Picture in this iteration. Real PiP is documented
as a separate future item rather than attempted blind, given the risk of
breaking the panorama for an uncertain gain.

## Consequences

- The panel cannot leave the browser tab/window; it's constrained to the
  widget's allocated area in the Experience Builder layout.
- Real PiP remains a possible future enhancement — see
  [`../known-issues.md`](../known-issues.md).
