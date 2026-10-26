import { React } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { Alert, Select, Switch, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { type IMConfig } from '../config'
import UpdateNotice from './components/UpdateNotice'
import { toAuthMode } from '../lib/authMode'
import { resolveLanguage, toLanguageChoice } from '../lib/locale'
import frMessages from './translations/default'
import enMessages from './translations/en'

const MESSAGES = { fr: frMessages, en: enMessages }

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {
  // This panel follows the builder's own language: the "Default language"
  // option below is for the published experience, not for this panel.
  const messages = MESSAGES[resolveLanguage(props.locale)]

  // onSelect returns a plain array (string[]), not an ImmutableArray:
  // same shape as WidgetJson.useMapWidgetIds on the framework side.
  const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds: useMapWidgetIds
    })
  }

  const onCompassEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('compassEnabled', event.target.checked)
    })
  }

  const onLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('language', toLanguageChoice(event.target.value))
    })
  }

  // `config.authMode` is absent on widgets saved before this option existed
  // — toAuthMode reads that as personal keys, the original behavior.
  const authMode = toAuthMode(props.config.authMode)

  const onAuthModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = toAuthMode(event.target.value)
    const config = props.config.set('authMode', nextMode)
    props.onSettingChange({
      id: props.id,
      // Back to personal keys, the shared key is erased rather than kept
      // for later: the configuration is downloaded by every visitor's
      // browser, and a key nobody uses any more would still be readable there.
      config: nextMode === 'shared' ? config : config.set('sharedApiKey', '')
    })
  }

  // Saved when the field loses focus or Enter is pressed (onAcceptValue), not
  // on every keystroke: each change re-signs the widget in with the new key,
  // and half-typed keys would be sent to Jakarto one after the other.
  const onSharedApiKeyAccepted = (value: string) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('sharedApiKey', value.trim())
    })
  }

  return (
    <div className="jakartowns-viewer-setting">
      <SettingSection title={messages.linkedMapSectionTitle}>
        <SettingRow>
          <MapWidgetSelector
            onSelect={onMapWidgetSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection title={messages.authSectionTitle}>
        <SettingRow label={messages.authModeLabel} flow="wrap">
          <Select
            size="sm"
            value={authMode}
            onChange={onAuthModeChange}
            aria-label={messages.authModeLabel}
          >
            <option value="personal">{messages.authModePersonalOption}</option>
            <option value="shared">{messages.authModeSharedOption}</option>
          </Select>
        </SettingRow>
        <SettingRow flow="wrap">
          <p className="mb-0 text-break">
            {authMode === 'shared' ? messages.authModeSharedHint : messages.authModePersonalHint}
          </p>
        </SettingRow>
        {authMode === 'shared' && (
          <>
            <SettingRow label={messages.sharedApiKeyLabel} flow="wrap">
              <TextInput
                size="sm"
                type="password"
                className="w-100"
                defaultValue={props.config.sharedApiKey}
                onAcceptValue={onSharedApiKeyAccepted}
                aria-label={messages.sharedApiKeyLabel}
                // "new-password" and not "off": browsers ignore "off" on a
                // password field and would offer the author's own saved
                // password here.
                autoComplete="new-password"
              />
            </SettingRow>
            <SettingRow flow="wrap">
              <p className="mb-0 text-break">{messages.sharedApiKeyHint}</p>
            </SettingRow>
            <SettingRow flow="wrap">
              <Alert
                form="basic"
                type="warning"
                open
                withIcon
                className="w-100"
                text={messages.sharedKeyWarningTitle}
              />
              <ul className="mt-2 mb-0 ps-4 text-break">
                <li>{messages.sharedKeyWarningStorage}</li>
                <li>{messages.sharedKeyWarningScope}</li>
                <li>{messages.sharedKeyWarningUsage}</li>
                <li>{messages.sharedKeyWarningPublic}</li>
              </ul>
            </SettingRow>
          </>
        )}
      </SettingSection>
      <SettingSection title={messages.panoramaSectionTitle}>
        <SettingRow label={messages.compassEnabledLabel}>
          <Switch
            checked={props.config.compassEnabled}
            onChange={onCompassEnabledChange}
          />
        </SettingRow>
        {/*
          `config.language` is absent on widgets saved before this option
          existed — toLanguageChoice reads that as 'auto'.
        */}
        <SettingRow label={messages.defaultLanguageLabel} flow="wrap">
          <Select
            size="sm"
            value={toLanguageChoice(props.config.language)}
            onChange={onLanguageChange}
            aria-label={messages.defaultLanguageLabel}
          >
            <option value="auto">{messages.languageAutoOption}</option>
            {/* Each language is named in itself, whichever language this panel is in. */}
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </SettingRow>
      </SettingSection>
      {/*
        Last section on purpose: it's information about the install, not a
        setting — `props.manifest` is injected by the framework at runtime
        and carries the version declared in the widget's manifest.json.
      */}
      <UpdateNotice installedVersion={props.manifest?.version} messages={messages} />
    </div>
  )
}

export default Setting
