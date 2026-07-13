# Bump the plugin version (default: patch), commit, tag, and push.
# Pushing the tag triggers the release workflow (tests + GitHub release with the widget zip).
# Usage: just bump-version [major|minor|patch]
bump-version part="patch":
    bump-my-version bump {{part}}
    git push --follow-tags
