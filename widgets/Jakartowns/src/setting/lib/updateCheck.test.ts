import {
  CACHE_TTL_MS,
  getLatestRelease,
  isNewerVersion,
  parseCachedRelease,
  parseLatestRelease,
  parseVersion,
  resolveUpdateStatus
} from './updateCheck'

// Private cache key in updateCheck.ts (not exported) — duplicated here from
// the current source, same convention as services/jakarto.test.ts. If the
// cache tests ever pass vacuously, check this against updateCheck.ts first.
const CACHE_STORAGE_KEY = 'jakartowns-viewer:latestRelease'

const NOW = Date.parse('2026-09-14T12:00:00Z')

function mockFetchOnce(response: Partial<Response>): void {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce(response as Response)
}

function githubPayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.2.0',
    html_url: 'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/tag/v1.2.0',
    draft: false,
    prerelease: false,
    ...overrides
  }
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = jest.fn() as unknown as typeof fetch
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('parseVersion', () => {
  it('parses a plain version and a v-prefixed tag identically', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3])
  })

  it('ignores what trails the patch number', () => {
    expect(parseVersion('1.2.3-rc.1')).toEqual([1, 2, 3])
  })

  it('returns null for anything unreadable', () => {
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion('latest')).toBeNull()
    expect(parseVersion('')).toBeNull()
    expect(parseVersion(null)).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it('compares numerically, not lexicographically', () => {
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(true)
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(false)
  })

  it('detects a newer major, minor or patch', () => {
    expect(isNewerVersion('1.0.2', '2.0.0')).toBe(true)
    expect(isNewerVersion('1.0.2', '1.1.0')).toBe(true)
    expect(isNewerVersion('1.0.2', '1.0.3')).toBe(true)
  })

  it('is false for the same version and for an older one', () => {
    expect(isNewerVersion('1.0.2', '1.0.2')).toBe(false)
    expect(isNewerVersion('1.0.2', 'v1.0.2')).toBe(false)
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(false)
  })

  it('stays quiet when either version is unreadable', () => {
    expect(isNewerVersion('unknown', '2.0.0')).toBe(false)
    expect(isNewerVersion('1.0.2', 'latest')).toBe(false)
  })
})

describe('parseLatestRelease', () => {
  it('strips the tag prefix and keeps the release page URL', () => {
    expect(parseLatestRelease(githubPayload())).toEqual({
      version: '1.2.0',
      url: 'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/tag/v1.2.0'
    })
  })

  it('falls back to the generic releases page when the payload has no html_url', () => {
    expect(parseLatestRelease(githubPayload({ html_url: undefined }))?.url).toBe(
      'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/latest'
    )
  })

  it('rejects drafts and pre-releases', () => {
    expect(parseLatestRelease(githubPayload({ draft: true }))).toBeNull()
    expect(parseLatestRelease(githubPayload({ prerelease: true }))).toBeNull()
  })

  it('rejects a payload without a usable tag', () => {
    expect(parseLatestRelease(githubPayload({ tag_name: 'nightly' }))).toBeNull()
    expect(parseLatestRelease(githubPayload({ tag_name: undefined }))).toBeNull()
    expect(parseLatestRelease(null)).toBeNull()
    expect(parseLatestRelease('v1.2.0')).toBeNull()
  })
})

describe('parseCachedRelease', () => {
  const cached = JSON.stringify({ version: '1.2.0', url: 'https://example.test/r', checkedAt: NOW })

  it('returns an entry that is still within the TTL', () => {
    expect(parseCachedRelease(cached, NOW + CACHE_TTL_MS - 1)).toEqual({
      version: '1.2.0',
      url: 'https://example.test/r'
    })
  })

  it('treats an expired entry as a miss', () => {
    expect(parseCachedRelease(cached, NOW + CACHE_TTL_MS + 1)).toBeNull()
  })

  it('treats an entry from the future as a miss (clock moved backwards)', () => {
    expect(parseCachedRelease(cached, NOW - 1)).toBeNull()
  })

  it('treats missing, corrupted or incomplete entries as a miss', () => {
    expect(parseCachedRelease(null, NOW)).toBeNull()
    expect(parseCachedRelease('{not json', NOW)).toBeNull()
    expect(parseCachedRelease(JSON.stringify({ version: '1.2.0' }), NOW)).toBeNull()
    expect(parseCachedRelease(JSON.stringify({ url: 'https://example.test/r', checkedAt: NOW }), NOW)).toBeNull()
  })
})

describe('getLatestRelease', () => {
  it('fetches from GitHub and caches the answer', async () => {
    mockFetchOnce({ ok: true, json: async () => githubPayload() })

    const release = await getLatestRelease({ now: NOW })

    expect(release).toEqual({
      version: '1.2.0',
      url: 'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/tag/v1.2.0'
    })
    expect(JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) ?? 'null')).toEqual({
      version: '1.2.0',
      url: 'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/tag/v1.2.0',
      checkedAt: NOW
    })
  })

  it('reuses the cache instead of hitting GitHub again', async () => {
    mockFetchOnce({ ok: true, json: async () => githubPayload() })
    await getLatestRelease({ now: NOW })

    const release = await getLatestRelease({ now: NOW + 1000 })

    expect(release).toEqual({
      version: '1.2.0',
      url: 'https://github.com/jakarto3d/experience-builder-jakarto-plugin/releases/tag/v1.2.0'
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches once the cached answer has expired', async () => {
    mockFetchOnce({ ok: true, json: async () => githubPayload() })
    await getLatestRelease({ now: NOW })

    mockFetchOnce({ ok: true, json: async () => githubPayload({ tag_name: 'v1.3.0' }) })
    const release = await getLatestRelease({ now: NOW + CACHE_TTL_MS + 1 })

    expect(release?.version).toBe('1.3.0')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('bypasses the cache when asked to refresh', async () => {
    mockFetchOnce({ ok: true, json: async () => githubPayload() })
    await getLatestRelease({ now: NOW })

    mockFetchOnce({ ok: true, json: async () => githubPayload({ tag_name: 'v1.3.0' }) })
    const release = await getLatestRelease({ now: NOW, forceRefresh: true })

    expect(release?.version).toBe('1.3.0')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null on an HTTP error (rate limit, private repo…) without caching it', async () => {
    mockFetchOnce({ ok: false, status: 403, json: async () => ({}) })

    expect(await getLatestRelease({ now: NOW })).toBeNull()
    expect(localStorage.getItem(CACHE_STORAGE_KEY)).toBeNull()
  })

  it('returns null when the network is unreachable (offline portal)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    expect(await getLatestRelease({ now: NOW })).toBeNull()
  })
})

describe('resolveUpdateStatus', () => {
  const release = { version: '1.2.0', url: 'https://example.test/r' }

  it('reports an available update when the release is newer', () => {
    expect(resolveUpdateStatus('1.0.2', release)).toEqual({ kind: 'updateAvailable', release })
  })

  it('reports up to date when the installed version is the latest or ahead of it', () => {
    expect(resolveUpdateStatus('1.2.0', release)).toEqual({ kind: 'upToDate' })
    // A locally built widget can be ahead of the last published release.
    expect(resolveUpdateStatus('1.3.0', release)).toEqual({ kind: 'upToDate' })
  })

  it('reports unknown when the check failed or the installed version is unreadable', () => {
    expect(resolveUpdateStatus('1.0.2', null)).toEqual({ kind: 'unknown' })
    expect(resolveUpdateStatus(undefined, release)).toEqual({ kind: 'unknown' })
  })
})
