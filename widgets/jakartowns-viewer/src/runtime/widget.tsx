import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { type IMConfig } from '../config'
import {
  checkAuthStatus,
  authenticate,
  logout,
  initializeViewer,
  buildJakartownsUrl,
  type JakartoPosition,
  type JakartoViewerHandle
} from './services/jakarto'
import { useSpatialSync } from './hooks/useSpatialSync'
import defaultMessages from './translations/default'
import './widget.css'

/**
 * Widget "Jakartowns Viewer".
 *
 * Se lie au widget Map choisi dans les réglages (useMapWidgetIds), affiche
 * le panorama Jakartowns (après connexion par clé API utilisateur) et
 * synchronise les deux vues :
 *   - clic sur la carte liée → le panorama se déplace à cet endroit
 *   - navigation dans le panorama → la carte liée recentre sa vue
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {
  const { useMapWidgetIds, config } = props
  const hasLinkedMap = !!(useMapWidgetIds && useMapWidgetIds.length > 0)

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const jimuMapViewRef = React.useRef<JimuMapView>(null)

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [authLoading, setAuthLoading] = React.useState(false)

  const viewerContainerRef = React.useRef<HTMLDivElement>(null)
  const viewerHandleRef = React.useRef<JakartoViewerHandle>(null)

  // Dernière position connue (clic carte ou navigation Jakartowns), utilisée
  // pour le lien "Ouvrir dans Jakartowns" (API URL) — disponible même sans
  // connexion à l'intégration API JS ci-dessous.
  const [currentPosition, setCurrentPosition] = React.useState<JakartoPosition | null>(null)

  const spatialSync = useSpatialSync()

  const onActiveViewChange = React.useCallback((view: JimuMapView) => {
    setJimuMapView(view)
  }, [])

  React.useEffect(() => {
    jimuMapViewRef.current = jimuMapView
  }, [jimuMapView])

  // Vérifie si une session Jakarto est déjà active (ex. cookie encore valide).
  React.useEffect(() => {
    checkAuthStatus().then(setIsAuthenticated)
  }, [])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    const ok = await authenticate(apiKeyInput)
    setAuthLoading(false)
    if (ok) {
      setIsAuthenticated(true)
      setApiKeyInput('')
    } else {
      setAuthError(defaultMessages.loginError)
    }
  }

  const handleLogout = async () => {
    await logout()
    viewerHandleRef.current?.destroy()
    viewerHandleRef.current = null
    setIsAuthenticated(false)
  }

  // Initialise le viewer Jakartowns une fois authentifié et le conteneur monté.
  React.useEffect(() => {
    if (!isAuthenticated || !viewerContainerRef.current) return

    let cancelled = false
    const view = jimuMapViewRef.current?.view
    const center = view?.center

    initializeViewer(viewerContainerRef.current, {
      headerEnabled: config.headerEnabled,
      minimapEnabled: config.minimapEnabled,
      latitude: center?.latitude ?? config.fallbackLatitude,
      longitude: center?.longitude ?? config.fallbackLongitude,
      onNavigate: (position: JakartoPosition) => {
        setCurrentPosition(position)
        spatialSync.onJakartoNavigate(position, (p) => {
          const activeView = jimuMapViewRef.current?.view
          activeView?.goTo({ center: [p.longitude, p.latitude] }, { duration: 600 })
        })
      }
    }).then((handle) => {
      if (cancelled) {
        handle?.destroy()
        return
      }
      viewerHandleRef.current = handle
    })

    return () => {
      cancelled = true
      viewerHandleRef.current?.destroy()
      viewerHandleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // Relaie les clics sur la carte liée vers le panorama Jakartowns.
  React.useEffect(() => {
    const view = jimuMapView?.view
    if (!view) return

    const clickHandle = view.on('click', (event) => {
      const { latitude, longitude } = event.mapPoint
      const position = { latitude, longitude }
      setCurrentPosition(position)
      spatialSync.onMapClick(position, (p) => {
        viewerHandleRef.current?.setPosition(p)
      })
    })

    return () => clickHandle.remove()
  }, [jimuMapView, spatialSync])

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
        <div className="jakartowns-viewer-toolbar">
          <a
            className="jakartowns-viewer-open-url-link"
            href={buildJakartownsUrl(currentPosition ?? {
              latitude: config.fallbackLatitude,
              longitude: config.fallbackLongitude
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            {defaultMessages.openInJakartownsLink}
          </a>
        </div>
      )}

      {hasLinkedMap && jimuMapView && !isAuthenticated && (
        <div className="jakartowns-viewer-login">
          <h3 className="jakartowns-viewer-login-title">{defaultMessages.loginTitle}</h3>
          {authError && <p className="jakartowns-viewer-login-error">{authError}</p>}
          <form className="jakartowns-viewer-login-form" onSubmit={handleLogin}>
            <label htmlFor="jakarto-apikey" className="jakartowns-viewer-login-label">
              {defaultMessages.loginLabel}
            </label>
            <input
              id="jakarto-apikey"
              type="password"
              className="jakartowns-viewer-login-input"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoComplete="current-password"
              required
            />
            <a
              href="https://solutions.jakarto.com/profile"
              target="_blank"
              rel="noopener noreferrer"
              className="jakartowns-viewer-login-link"
            >
              {defaultMessages.loginLink}
            </a>
            <button type="submit" className="jakartowns-viewer-login-btn" disabled={authLoading}>
              {authLoading ? defaultMessages.loginButtonLoading : defaultMessages.loginButton}
            </button>
          </form>
        </div>
      )}

      {hasLinkedMap && jimuMapView && isAuthenticated && (
        <div className="jakartowns-viewer-panorama-wrapper">
          <button className="jakartowns-viewer-logout-btn" onClick={handleLogout}>
            {defaultMessages.logoutButton}
          </button>
          <div ref={viewerContainerRef} className="jakartowns-viewer-panorama" />
        </div>
      )}
    </div>
  )
}

export default Widget
