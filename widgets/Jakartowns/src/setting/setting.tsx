import { React } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { Switch } from 'jimu-ui'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { type IMConfig } from '../config'
import UpdateNotice from './components/UpdateNotice'
import defaultMessages from './translations/default'

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {
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

  return (
    <div className="jakartowns-viewer-setting">
      <SettingSection title={defaultMessages.linkedMapSectionTitle}>
        <SettingRow>
          <MapWidgetSelector
            onSelect={onMapWidgetSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection title={defaultMessages.panoramaSectionTitle}>
        <SettingRow label={defaultMessages.compassEnabledLabel}>
          <Switch
            checked={props.config.compassEnabled}
            onChange={onCompassEnabledChange}
          />
        </SettingRow>
      </SettingSection>
      {/*
        Last section on purpose: it's information about the install, not a
        setting — `props.manifest` is injected by the framework at runtime
        and carries the version declared in the widget's manifest.json.
      */}
      <UpdateNotice installedVersion={props.manifest?.version} />
    </div>
  )
}

export default Setting
