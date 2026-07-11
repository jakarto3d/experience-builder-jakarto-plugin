# 0003 — Per-user API key authentication

- Date: 2026-07-10
- Status: Accepted

## Context

The widget needs to authenticate against Jakartowns to load panoramas. Two
approaches were possible: a shared service API key (configured once by the
portal administrator) or a per-end-user API key entered in the widget itself.

## Decision

Each portal visitor enters their own Jakarto API key (retrievable at
`https://solutions.jakarto.com/profile`). No shared service key by default.

## Consequences

- Every user needs their own Jakarto account and a valid API key to use the
  widget — no "anonymous" access through an organization-wide shared key.
- The key is cached after a successful login to avoid re-entry on every
  visit (see
  [`0004-cache-api-key-in-localstorage.md`](0004-cache-api-key-in-localstorage.md)).
- The authentication flow (key → session cookie exchange, `v1.js` script) is
  described in
  [`../specs/jakartowns-integration.md`](../specs/jakartowns-integration.md).
