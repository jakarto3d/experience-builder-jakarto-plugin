# 0004 — Cache the API key in localStorage

- Date: 2026-07-10
- Status: Accepted

## Context

The existing session-check endpoint (`GET account.jakarto.com/auth`, called
`checkAuthStatus`) is blocked by CORS from most embedding origins (confirmed
in a real environment: request rejected from `localhost:3001`, expected
behavior since that origin isn't allowlisted by the Jakarto server). It
can't be relied on to auto-detect an already-active session — without
another mechanism, the user would have to re-enter their API key on every
page reload.

## Decision

Cache the API key in the browser's `localStorage`
(`jakartowns-viewer:apiKey`) after a successful authentication. On mount,
the widget attempts an automatic reconnect with the cached key before
showing the login form.

## Consequences

- **Accepted trade-off**: the key is stored in plaintext client-side, not
  encrypted.
- `localStorage` access is isolated in `try/catch` wrappers (see
  `services/jakarto.ts`): in strict private browsing or a sandboxed iframe,
  writes can fail silently — in that case the user simply re-enters their
  key on every visit (not a blocking error).
- `logout()` clears the cached key in addition to invalidating the session
  cookie.
