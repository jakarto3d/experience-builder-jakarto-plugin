import type defaultMessages from './default'

// Typed against default.ts (French) so a missing or misspelled key fails the
// typecheck instead of rendering `undefined` in the panel.
const messages: typeof defaultMessages = {
  _widgetLabel: 'Jakartowns Viewer',
  noMapWidgetLinked: 'This widget is not linked to a map. Open its settings and choose a Map widget.',
  waitingForMap: 'Connecting to the linked map…',
  loginTitle: 'Jakarto sign-in',
  loginLabel: 'Jakarto API key',
  loginButton: 'Sign in',
  loginButtonLoading: 'Signing in…',
  loginError: 'Sign-in failed. Check your API key.',
  loginLink: 'Get your API key',
  sharedKeyConnecting: 'Connecting to Jakarto…',
  sharedKeyMissing:
    'Unable to open the panorama: no shared API key has been set up for this experience. Contact whoever administers this experience.',
  sharedKeyFailed:
    'Unable to open the panorama: signing in to Jakarto with the shared API key of this experience failed. Contact whoever administers this experience.',
  logoutButton: 'Sign out',
  openInJakartownsLink: 'Open in Jakartowns ↗',
  foldPanel: 'Collapse',
  unfoldPanel: 'Expand',
  pickingModeLabel: 'Click on the map',
  pickingModeHint: 'Click on the map to locate the panorama.',
  multipassUnknownDate: 'Unknown date',
  timelineScrollPrevious: 'Previous dates',
  timelineScrollNext: 'Next dates',
  settingsLabel: 'Settings',
  languageLabel: 'Language',
  languageUseDefault: 'Default',
  settingsRightClickLabel: 'Enable right-click on the map to locate the panorama',
  panoramaWaitingForPick: 'Press “Click on the map”, then click the map, to display a Jakartowns panorama.'
}

export default messages
