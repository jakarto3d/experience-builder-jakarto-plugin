# 0016 — Make the release build rehearsable before tagging

- Date: 2026-07-29
- Status: Accepted

## Context

[ADR-0015](0015-automate-portal-ready-release-build.md) moved the
portal-ready build into `.github/workflows/release.yml`, as a sequence of
inline `run:` steps in the `release` job. That job only ever fires on a
pushed `v*` tag, which makes it awkward to change:

- The only way to exercise it is `just bump-version`, which bumps, commits,
  tags and pushes in one go. A mistake in the workflow is therefore found
  *after* a version number has been burned and a (possibly broken or
  half-published) release exists.
- Every attempt re-downloads the SDK, installs Chromium, re-installs the
  SDK's `client/` dependencies and re-runs the webpack build, with nothing
  cached between runs — minutes per iteration, all of it on a runner.
- The build logic lived in YAML, so it could not be run at all outside a
  runner: nothing to invoke locally, no way to reproduce a failure except
  by re-reading the steps and retyping them by hand (which is exactly how
  the manual first deployment was done, per ADR-0015).

## Decision

- Moved the build out of YAML into `scripts/build-release.mjs`, which
  produces both zips for a given `--tag`. The workflow now calls that one
  script, so CI and a developer's machine run the same code path rather
  than two transcriptions of the same steps.
- The script caches the SDK under `.exb-cache/` (downloaded zip, unpacked
  copy, and its installed `node_modules`) and reuses all three on later
  runs: a warm rebuild of both zips measures ~2 s. `--fresh` discards the
  cache; `--source-only` skips the SDK entirely.
- The script fails loudly on the two things that silently produced a broken
  artifact before: a Node version other than 20.x (the `tinyglobby`
  constraint, with an `fnm exec` hint in the error), and a build whose
  output is missing `dist/runtime/widget.js` — the exact defect ADR-0015
  was written about. It also deletes `dist-prod/` and any pre-existing zip
  before writing, since both `build:prod` and `zip -r` otherwise merge into
  what an earlier run left behind.
- `release.yml` gained a `workflow_dispatch` trigger with a `tag` input, so
  the pipeline can also be rehearsed on a real runner from the Actions tab.
  Artifacts are uploaded to the run on every trigger; the GitHub release is
  created only when `github.ref_type == 'tag'`. The publish step is also
  guarded by `!env.ACT` so a local [act](https://github.com/nektos/act) run
  cannot publish to the real repository, and `.actrc` pins a runner image
  that actually has `zip`/`unzip`.
- CI caches the SDK zip by Experience Builder version
  (`actions/cache`, key `exb-sdk-<major.minor>`) and only installs Chromium
  on a cache miss, since the browser exists solely to click Esri's
  download button.
- Added `just check`, `just build-release`, `just build-release-source` and
  `just act-release`; `just build-release` re-execs itself through
  `fnm exec --using v20.20.2` when the default Node isn't 20.x.

## Consequences

- Releasing is now: `just build-release` (or `just build-release <tag>`),
  inspect `dist-release/`, then `just bump-version`. A broken build is
  found before a version number is spent.
- `.exb-cache/` is several GB of gitignored local state. It is keyed by
  Experience Builder major.minor, so bumping `manifest.json`'s `exbVersion`
  starts a fresh cache entry rather than silently building against the old
  SDK — but the stale entry stays on disk until deleted by hand.
- The build steps are no longer readable from the workflow file alone;
  `release.yml` says *when* a release is built and `build-release.mjs` says
  *how*. Changing the build now means changing a script, which is the point.
- `act` is a supported way to run the workflow, but not the recommended
  one: it re-does the whole download-and-install inside a throwaway
  container, so it verifies the YAML rather than the artifact.
