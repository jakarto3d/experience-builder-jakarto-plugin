# Run the checks CI runs on every push and pull request.
check:
    npm test
    npm run typecheck
    npm run widget-check

# Runs the same script the release workflow runs, without tagging or publishing
# anything. The first run downloads the Experience Builder SDK into .exb-cache/
# and installs its dependencies (~1.2 GB); later runs reuse both and take a
# couple of seconds. Extra flags are passed through, e.g.
# `just build-release dry-run --fresh`.
# Build both release zips into dist-release/. Usage: just build-release [tag] [flags...]
build-release tag="dry-run" *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    # The SDK build only works on Node 20.x (tinyglobby); use fnm to get there
    # if the default Node is something else.
    if [ "$(node -p 'process.versions.node.split(".")[0]')" != "20" ] && command -v fnm >/dev/null; then
        fnm exec --using v20.20.2 node scripts/build-release.mjs --tag {{tag}} {{flags}}
    else
        node scripts/build-release.mjs --tag {{tag}} {{flags}}
    fi

# Build only the source-only zip — seconds instead of minutes, no SDK needed.
build-release-source tag="dry-run":
    node scripts/build-release.mjs --tag {{tag}} --source-only

# Runs the workflow itself in a container via act (https://github.com/nektos/act).
# Slower and heavier than `just build-release`, which builds the same artifacts
# directly — reach for this to check the workflow's plumbing, not the widget build.
# Rehearse the release workflow in a container (needs act + docker).
act-release *flags="": _require-act
    act workflow_dispatch -W .github/workflows/release.yml {{flags}}

# Rehearse the release workflow without executing it (fast YAML/expression check).
act-release-dry: _require-act
    act workflow_dispatch -W .github/workflows/release.yml --dryrun

# Tell the user how to install act/docker instead of failing with `act: not found`.
_require-act:
    #!/usr/bin/env bash
    if ! command -v act >/dev/null; then
        printf '%s\n' >&2 \
            "act is not installed — it runs GitHub Actions workflows locally, in Docker." \
            "" \
            "Install it with either:" \
            "  curl -sSL https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash -s -- -b /usr/local/bin" \
            "  gh extension install https://github.com/nektos/gh-act   # then run 'gh act' instead of 'act'" \
            "" \
            "If it asks which runner image to use, pick Medium — the default Micro" \
            "image has no zip/unzip. This repo's .actrc already pins a suitable one." \
            "" \
            "You probably don't need act, though: 'just build-release' builds the same" \
            "artifacts directly on your machine, in seconds once the SDK is cached."
        exit 1
    fi
    if ! docker info >/dev/null 2>&1; then
        echo "act needs a running Docker daemon, and 'docker info' failed." >&2
        echo "Start Docker (e.g. 'sudo systemctl start docker') and retry." >&2
        exit 1
    fi

# Bump the plugin version (default: patch), commit, tag, and push.
# Pushing the tag triggers the release workflow (checks + GitHub release with
# both widget zips). Rehearse with `just build-release` first.
# Usage: just bump-version [major|minor|patch]
bump-version part="patch":
    bump-my-version bump {{part}}
    git push --follow-tags
