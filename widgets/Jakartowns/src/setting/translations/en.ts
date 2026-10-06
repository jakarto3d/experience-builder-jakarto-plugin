import type defaultMessages from './default'

// Typed against default.ts (French) so a missing or misspelled key fails the
// typecheck instead of rendering `undefined` in the settings panel.
const messages: typeof defaultMessages = {
  linkedMapSectionTitle: 'Linked map',
  panoramaSectionTitle: 'Panorama',
  compassEnabledLabel: 'Show compass',
  defaultLanguageLabel: 'Default language',
  languageAutoOption: 'Automatic (follow Experience Builder’s language)',
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
