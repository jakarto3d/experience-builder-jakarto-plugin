import { React } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { Select, Switch } from 'jimu-ui'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { type IMConfig } from '../config'
import UpdateNotice from './components/UpdateNotice'
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
