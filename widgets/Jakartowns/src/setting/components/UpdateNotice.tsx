import { React } from 'jimu-core'
import { Alert } from 'jimu-ui'
import { SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { getLatestRelease, resolveUpdateStatus, type UpdateStatus } from '../lib/updateCheck'
import type frMessages from '../translations/default'

/**
 * "Widget version" section of the settings panel: shows which version is
 * installed and, when a newer release exists, how to get it.
 *
 * Deliberately confined to the settings panel (builder-side): the person who
 * can act on the message is whoever registered the widget on the portal, and
 * a banner in the published experience would only be noise for its visitors
 * — see docs/adr/0017-in-builder-update-notification.md.
 */

interface UpdateNoticeProps {
  /** `manifest.version` of the installed widget — absent if the framework injected no manifest. */
  installedVersion?: string
  /** The settings panel's strings in the builder's language (see lib/locale.ts). */
  messages: typeof frMessages
}

/** The translations only ever interpolate a version number — no need for `intl` formatting here. */
function withVersion(template: string, version: string): string {
  return template.replace('{version}', version)
}

const UpdateNotice = (props: UpdateNoticeProps) => {
  const { installedVersion, messages } = props
  const [status, setStatus] = React.useState<UpdateStatus>({ kind: 'checking' })

  React.useEffect(() => {
    let cancelled = false
    // getLatestRelease never rejects: an unreachable github.com resolves to
    // null, which resolveUpdateStatus turns into the 'unknown' state.
    void getLatestRelease().then((release) => {
      if (!cancelled) {
        setStatus(resolveUpdateStatus(installedVersion, release))
      }
    })
    // The settings panel is mounted and unmounted every time the widget is
    // selected in the builder — without this guard, a check still in flight
    // would call setState on an unmounted component.
    return () => { cancelled = true }
  }, [installedVersion])

  return (
    <SettingSection title={messages.versionSectionTitle}>
      <SettingRow label={messages.installedVersionLabel}>
        <span>{installedVersion ?? '—'}</span>
      </SettingRow>
      {status.kind === 'updateAvailable'
        ? (
        <SettingRow flow="wrap">
          <Alert
            form="basic"
            type="info"
            open
            withIcon
            className="w-100"
            text={withVersion(messages.updateAvailableTitle, status.release.version)}
          />
          <p className="mt-2 mb-1 text-break">
            {withVersion(messages.updateAvailableHint, status.release.version)}
          </p>
          <a href={status.release.url} target="_blank" rel="noopener noreferrer">
            {withVersion(messages.updateAvailableLinkLabel, status.release.version)}
          </a>
        </SettingRow>
          )
        : (
        <SettingRow flow="wrap">
          <span className="text-break">
            {status.kind === 'checking' && messages.versionCheckingLabel}
            {status.kind === 'upToDate' && messages.versionUpToDateLabel}
            {status.kind === 'unknown' && messages.versionUnknownLabel}
          </span>
        </SettingRow>
          )}
    </SettingSection>
  )
}

export default UpdateNotice
