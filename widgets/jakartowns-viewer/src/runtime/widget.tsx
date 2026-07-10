import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { type IMConfig } from '../config'
import defaultMessages from './translations/default'
import './widget.css'

/**
 * Widget "Jakartowns Viewer".
 *
 * État actuel (scaffold) : établit la liaison avec le widget Map choisi dans
 * les réglages (useMapWidgetIds) et affiche un conteneur pour le panorama.
 * L'intégration Jakartowns elle-même (auth, embed, sync bidirectionnelle)
 * est ajoutée dans un commit séparé — voir docs/progress.md.
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {
  const { useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)

  const onActiveViewChange = React.useCallback((view: JimuMapView) => {
    setJimuMapView(view)
  }, [])

  const hasLinkedMap = !!(useMapWidgetIds && useMapWidgetIds.length > 0)

  return (
    <div className="jakartowns-viewer-widget jimu-widget">
      {useMapWidgetIds && (
        <JimuMapViewComponent
          useMapWidgetIds={useMapWidgetIds}
          onActiveViewChange={onActiveViewChange}
        />
      )}

      {!hasLinkedMap && (
        <div className="jakartowns-viewer-placeholder">
          {defaultMessages.noMapWidgetLinked}
        </div>
      )}

      {hasLinkedMap && !jimuMapView && (
        <div className="jakartowns-viewer-placeholder">
          {defaultMessages.waitingForMap}
        </div>
      )}

      {hasLinkedMap && jimuMapView && (
        <div className="jakartowns-viewer-placeholder">
          {defaultMessages.mapLinkedPlaceholder}
        </div>
      )}
    </div>
  )
}

export default Widget
