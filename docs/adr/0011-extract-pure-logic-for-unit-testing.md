# 0011 — Extract pure logic out of widget.tsx, add a root-level Jest harness

- Date: 2026-07-13
- Status: Accepted

## Context

Per [ADR-0001](0001-scaffold-without-local-dev-edition.md), this repo has no
build tooling and can't install `jimu-core`/`jimu-ui`/`jimu-arcgis` as regular
npm dependencies. ArcGIS Experience Builder's own unit-testing convention
(Jest + `@testing-library/react` + `jimu-for-test`, run via `npm test` from a
Developer Edition's `client/` folder) inherits the same constraint:
`jimu-for-test` is part of the same jimu-* family and isn't installable here
either. Before this change, the repo had zero test tooling and zero
automated tests.

`services/jakarto.ts` and `lib/observerIcon.ts` already had no jimu
dependency (only `fetch`/`window`/`document`), but `widget.tsx` mixed real
jimu/ArcGIS wiring with a fair amount of logic that had no actual jimu
dependency — panel drag/resize/fold geometry (plain numbers and DOM rects),
the pan-to-marker-angle conversion, date formatting, and the multipass
timeline derivation — all trapped in a file that imports `jimu-core`/
`jimu-arcgis` at the top, making even those pure pieces untestable without
mocking the whole framework.

## Decision

- Extracted the jimu-free logic out of `widget.tsx` into new modules under
  `src/runtime/lib/` (`panelGeometry.ts`, `timeline.ts`, `format.ts`) and
  extended the existing `lib/observerIcon.ts`
  (`jakartownsPanToMarkerAngle`, `roundObserverFov`). Extraction rule
  followed throughout: move the computation, never the decision of
  whether/what to call `setState` — `widget.tsx` keeps its original
  conditionals (e.g. the resize handler only updates the panel's position
  for left/top-side handles) and only delegates the math.
- Added a Jest test harness (`jest`, `ts-jest`, `jest-environment-jsdom`) at
  the **repository root**, not inside `widgets/Jakartowns/`, so the test
  tooling/`node_modules` never get copied along when that folder is
  installed into a Developer Edition (see `widgets/Jakartowns/README.md`).
  Chose Jest specifically (not e.g. Vitest) to match ArcGIS Experience
  Builder's own convention, in case these test files ever need to coexist
  with `jimu-for-test`-based specs inside a real Dev Edition's `client/`
  run via `npm test`.
- Added real tests for the newly extracted modules and for the
  previously-untested `services/jakarto.ts` and `lib/observerIcon.ts`
  (fetch/localStorage/window-event mocking for the Jakartowns integration
  layer).
- Added a disposable `types/jimu-stubs.d.ts` + `tsconfig.widget-check.json`
  (ambient `declare module 'jimu-core'` etc., covering all of `src/**`) as
  a `tsc --noEmit` sanity net on `widget.tsx`/`setting.tsx` after the
  refactor — catches wrong import paths or argument mismatches from moving
  code, but not jimu-typing errors (everything from jimu becomes `any`
  under the stub).
- Deliberately did **not** write `jimu-for-test`-based specs for
  `widget.tsx`'s JSX/render tree or for `setting.tsx`: they can't even
  type-check here, and a test file that can't run risks bit-rotting into
  false confidence. That gap is the same one already tracked in
  [`../known-issues.md`](../known-issues.md).

## Consequences

- `npm install && npm test` from the repo root now runs real, passing
  tests over all the widget's business logic that doesn't require a
  Developer Edition.
- A GitHub Actions workflow (`.github/workflows/test.yml`) runs `npm test`,
  `npm run typecheck`, and `npm run widget-check` on every push/PR to
  `main`, so this coverage is enforced automatically rather than being
  opt-in.
- `widget.tsx` itself is thinner: JSX, `JimuMapViewComponent`/
  `loadArcGISJSAPIModules`/`view.on(...)` wiring, ArcGIS
  `Graphic`/`GraphicsLayer` mutation, and React state/refs — the actual
  math it depends on now lives in tested modules.
- The refactor was mechanical (verbatim logic moves) since `widget.tsx`
  still can't be compiled or run end-to-end here; `npm run widget-check`
  (the ambient-stub `tsc --noEmit`) is the closest available safety net
  short of a real Developer Edition smoke test, which remains the
  authoritative verification per ADR-0001.
- The render tree and jimu/ArcGIS wiring remain unverified by automated
  tests, same limitation as before this change.
