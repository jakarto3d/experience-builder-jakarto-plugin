import { React } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { Switch } from 'jimu-ui'
import { type IMConfig } from '../config'
import defaultMessages from './translations/default'

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {
  // onSelect renvoie un tableau simple (string[]), pas un ImmutableArray :
  // c'est la même forme que WidgetJson.useMapWidgetIds côté framework.
  const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds: useMapWidgetIds
    })
  }

  const onHeaderEnabledChange = (checked: boolean) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('headerEnabled', checked)
    })
  }

  const onMinimapEnabledChange = (checked: boolean) => {
    props.onSettingChange({
      id: props.id,
      config: props.config.set('minimapEnabled', checked)
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

      <SettingSection title={defaultMessages.displaySectionTitle}>
        <SettingRow label={defaultMessages.headerEnabledLabel} tag="label">
          <Switch
            checked={props.config.headerEnabled}
            onChange={(e) => onHeaderEnabledChange(e.target.checked)}
          />
        </SettingRow>
        <SettingRow label={defaultMessages.minimapEnabledLabel} tag="label">
          <Switch
            checked={props.config.minimapEnabled}
            onChange={(e) => onMinimapEnabledChange(e.target.checked)}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}

export default Setting
