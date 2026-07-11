import { React } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { type IMConfig } from '../config'
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
    </div>
  )
}

export default Setting
