import type defaultMessages from './default'

// Typed against default.ts (French) so a missing or misspelled key fails the
// typecheck instead of rendering `undefined` in the settings panel.
const messages: typeof defaultMessages = {
  linkedMapSectionTitle: 'Linked map',
  panoramaSectionTitle: 'Panorama',
  compassEnabledLabel: 'Show compass',
  defaultLanguageLabel: 'Default language',
  languageAutoOption: 'Automatic (follow Experience Builder’s language)',
  authSectionTitle: 'Jakarto sign-in',
  authModeLabel: 'Sign-in mode',
  authModePersonalOption: 'Personal keys',
  authModeSharedOption: 'Shared key',
  authModePersonalHint:
    'Each person who opens the experience enters their own Jakarto API key. Everyone keeps their own access rights and their own usage statistics.',
  authModeSharedHint:
    'The widget signs everyone in with a single API key: there is nothing to enter, and the panorama opens directly.',
  sharedApiKeyLabel: 'Shared API key',
  sharedApiKeyHint: 'We recommend the key of a dedicated Jakarto service account rather than a person’s key.',
  sharedKeyWarningTitle: 'Caution: anyone who opens the experience will be able to read this key',
  sharedKeyWarningStorage:
    'The widget’s settings are saved in the experience’s configuration, which the browser downloads.',
  sharedKeyWarningScope:
    'The key gives access to everything the account’s licence allows, not only this widget, and it cannot be restricted to the portal’s domain.',
  sharedKeyWarningUsage:
    'Everyone gets the same access, and usage is counted as a single total: misuse is easy to miss.',
  sharedKeyWarningPublic:
    'If the experience is public, anyone on the Internet can get this key and use it. This mode mostly suits experiences reserved for your organization.',
  versionSectionTitle: 'Widget version',
  installedVersionLabel: 'Installed version',
  versionCheckingLabel: 'Checking…',
  versionUpToDateLabel: 'Up to date',
  versionUnknownLabel: 'Unable to check for updates (no access to github.com)',
  updateAvailableTitle: 'Update available: {version}',
  updateAvailableHint:
    'Download “Jakartowns-v{version}-portal.zip” from the release page, then replace the custom widget file in the portal.',
  updateAvailableLinkLabel: 'View release {version}'
}

export default messages
