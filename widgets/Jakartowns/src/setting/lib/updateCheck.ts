/**
 * setting/lib/updateCheck.ts
 *
 * Nothing in an ArcGIS Enterprise portal tells whoever registered this
 * widget as a custom widget resource that a newer version was released:
 * the zip was uploaded by hand, and it stays at that version forever. This
 * module compares the installed `manifest.json` version against the latest
 * published GitHub release so the settings panel — the one surface the
 * person who installs/configures the widget actually opens — can say it out
 * loud (see docs/adr/0017-in-builder-update-notification.md).
 *
 * Everything here is deliberately non-blocking and silent on failure: a
 * portal with no outbound Internet access, a proxy, or GitHub's 60
 * requests/hour unauthenticated rate limit must degrade to "unknown", never
 * to an error in the settings panel.
 */

/** Public, unauthenticated, CORS-enabled (`access-control-allow-origin: *`). */
const LATEST_RELEASE_API_URL =
  'https://api.github.com/repos/jakarto3d/experience-builder-jakarto-plugin/releases/latest'
/** Fallback target for the "see the release" link if the payload has no `html_url`. */
const LATEST_RELEASE_PAGE_URL =
  'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/latest'
const CACHE_STORAGE_KEY = 'jakartowns-viewer:latestRelease'

/**
 * How long a successful answer is reused. A day is far below the release
 * cadence of this widget, and keeps a builder session that opens the
 * settings panel repeatedly from burning through GitHub's per-IP rate limit
 * (shared by everyone behind the same portal/proxy).
 */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** `MAJOR.MINOR.PATCH`, as required by Experience Builder for `manifest.version`. */
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/

export interface LatestRelease {
  /** Version number without the tag's leading `v` (e.g. `1.2.0` for tag `v1.2.0`). */
  version: string
  /** Release page to send the user to. */
  url: string
}

interface CachedRelease extends LatestRelease {
  /** `Date.now()` when the answer was fetched. */
  checkedAt: number
}

/** What the settings panel renders — see components/UpdateNotice.tsx. */
export type UpdateStatus =
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'updateAvailable', release: LatestRelease }
  /** Check impossible (offline portal, proxy, rate limit) or version unreadable. */
  | { kind: 'unknown' }

/**
 * Parses `1.2.3` / `v1.2.3` into comparable numbers. Anything trailing
 * (`1.2.3-rc.1`) is ignored rather than rejected: pre-release ordering isn't
 * worth implementing here, since `/releases/latest` never returns a
 * pre-release in the first place.
 */
export function parseVersion(raw: string | null | undefined): [number, number, number] | null {
  if (typeof raw !== 'string') return null
  const match = VERSION_PATTERN.exec(raw.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Whether `latest` is strictly newer than `installed`. An unreadable version
 * on either side returns `false` — a widget that can't tell must stay quiet
 * rather than nag about an update that may not exist.
 */
export function isNewerVersion(installed: string | null | undefined, latest: string | null | undefined): boolean {
  const installedParts = parseVersion(installed)
  const latestParts = parseVersion(latest)
  if (!installedParts || !latestParts) return false
  for (let i = 0; i < installedParts.length; i++) {
    if (latestParts[i] !== installedParts[i]) return latestParts[i] > installedParts[i]
  }
  return false
}

/**
 * Narrows the GitHub release payload down to what the notice needs.
 * `draft`/`prerelease` can't normally come out of `/releases/latest`, but are
 * filtered anyway so a hand-pointed URL can't surface an unreleased version.
 */
export function parseLatestRelease(payload: unknown): LatestRelease | null {
  if (typeof payload !== 'object' || payload === null) return null
  const release = payload as Record<string, unknown>
  if (release.draft === true || release.prerelease === true) return null
  if (typeof release.tag_name !== 'string') return null
  const version = release.tag_name.trim().replace(/^v/, '')
  if (!parseVersion(version)) return null
  return {
    version,
    url: typeof release.html_url === 'string' ? release.html_url : LATEST_RELEASE_PAGE_URL
  }
}

/**
 * Reads a previously cached answer, or `null` if there is none, it's
 * corrupted, or it has expired.
 */
export function parseCachedRelease(raw: string | null, now: number, ttlMs: number = CACHE_TTL_MS): LatestRelease | null {
  if (!raw) return null
  let cached: CachedRelease
  try {
    cached = JSON.parse(raw)
  } catch {
    // Corrupted JSON: treat it as a cache miss instead of crashing.
    return null
  }
  if (typeof cached?.version !== 'string' || typeof cached?.url !== 'string') return null
  if (typeof cached.checkedAt !== 'number' || !Number.isFinite(cached.checkedAt)) return null
  // `now - checkedAt` can be negative if the clock moved backwards, or huge if
  // it moved forward — either way, anything outside the window is a miss.
  const age = now - cached.checkedAt
  if (age < 0 || age > ttlMs) return null
  return { version: cached.version, url: cached.url }
}

/**
 * localStorage can throw (strict private browsing, sandboxed iframe…) —
 * same reasoning as the wrappers in runtime/services/jakarto.ts, duplicated
 * here rather than imported so the settings bundle doesn't pull in the whole
 * viewer integration.
 */
function readCache(): string | null {
  try {
    return window.localStorage.getItem(CACHE_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeCache(release: LatestRelease, now: number): void {
  const cached: CachedRelease = { ...release, checkedAt: now }
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // Not blocking: the check just runs again on the next settings panel open.
  }
}

export interface GetLatestReleaseOptions {
  /** Injected in tests; defaults to the wall clock. */
  now?: number
  /** Skips the cache (not wired to any UI yet — kept for a manual "check now"). */
  forceRefresh?: boolean
}

/**
 * Returns the latest published release, from cache when it's fresh enough,
 * otherwise from GitHub. Never rejects: `null` means "couldn't tell".
 */
export async function getLatestRelease(options: GetLatestReleaseOptions = {}): Promise<LatestRelease | null> {
  const now = options.now ?? Date.now()

  if (!options.forceRefresh) {
    const cached = parseCachedRelease(readCache(), now)
    if (cached) return cached
  }

  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      // No cookie should ever be sent to GitHub from a portal page.
      credentials: 'omit',
      mode: 'cors'
    })
    if (!response.ok) return null
    const release = parseLatestRelease(await response.json())
    if (release) writeCache(release, now)
    return release
  } catch {
    // Offline portal, proxy, DNS, CORS… — all "couldn't tell", never an error
    // surfaced to the user. Not logged either: the settings panel is opened
    // often, and a red console line would look like a widget failure.
    return null
  }
}

/** Maps an installed version + fetched release onto what the notice shows. */
export function resolveUpdateStatus(installedVersion: string | null | undefined, release: LatestRelease | null): UpdateStatus {
  if (!release || !parseVersion(installedVersion)) return { kind: 'unknown' }
  return isNewerVersion(installedVersion, release.version)
    ? { kind: 'updateAvailable', release }
    : { kind: 'upToDate' }
}
