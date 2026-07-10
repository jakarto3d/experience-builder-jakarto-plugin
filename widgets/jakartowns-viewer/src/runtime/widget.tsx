import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { type IMConfig } from '../config'
import {
  getStoredApiKey,
  authenticate,
  logout,
  initializeViewer,
  buildJakartownsUrl,
  type JakartoPosition,
  type JakartoViewerHandle,
  type JakartoMultipassImage
} from './services/jakarto'
import { projectPoint, reflectAngle, getJakartownsPanTowards, LOOK_AHEAD_DISTANCE_METERS, type LatLng } from './lib/lookAt'
import { useSpatialSync } from './hooks/useSpatialSync'
import defaultMessages from './translations/default'
import './widget.css'

const DEFAULT_PANEL_WIDTH = 380
const DEFAULT_PANORAMA_HEIGHT = 320
const MIN_PANEL_WIDTH = 260
const MIN_PANORAMA_HEIGHT = 180
const TIMELINE_SCROLL_STEP = 160

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
  maxLeft: number
  maxTop: number
}

interface ResizeState {
  pointerId: number
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
  maxWidth: number
  maxHeight: number
}

interface PanelPosition {
  left: number
  top: number
}

interface PanelSize {
  width: number
  height: number
}

const IconChevron = ({ folded }: { folded: boolean }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ transform: folded ? 'rotate(180deg)' : 'none' }}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
)

const IconLogout = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

const IconTarget = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

const IconExternalLink = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
  </svg>
)

function formatJakartoDate(dateString: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

/**
 * Widget "Jakartowns Viewer".
 *
 * Se lie au widget Map choisi dans les réglages (useMapWidgetIds) et affiche
 * le panorama Jakartowns dans un panneau flottant, repliable, déplaçable et
 * redimensionnable (dans les limites du widget). Deux façons de pointer un
 * endroit sur la carte liée :
 *   - mode "pointage" armé via le bouton dédié : le prochain clic gauche
 *     localise puis se désarme automatiquement (usage ponctuel)
 *   - clic droit sur la carte : toujours actif, sans devoir armer quoi que
 *     ce soit
 * Naviguer dans le panorama recentre la carte dans l'autre sens.
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {
  const { useMapWidgetIds, config } = props
  const hasLinkedMap = !!(useMapWidgetIds && useMapWidgetIds.length > 0)

  const widgetRootRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const dragStateRef = React.useRef<DragState | null>(null)
  const resizeStateRef = React.useRef<ResizeState | null>(null)
  const [panelPosition, setPanelPosition] = React.useState<PanelPosition | null>(null)
  const [panelSize, setPanelSize] = React.useState<PanelSize>({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANORAMA_HEIGHT })
  const [isPanelFolded, setIsPanelFolded] = React.useState(false)

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const jimuMapViewRef = React.useRef<JimuMapView>(null)

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [authLoading, setAuthLoading] = React.useState(false)

  const viewerContainerRef = React.useRef<HTMLDivElement>(null)
  const viewerHandleRef = React.useRef<JakartoViewerHandle>(null)
  const timelineListRef = React.useRef<HTMLDivElement>(null)
  // Point visé calculé avant un changement d'image multipass, consommé au
  // prochain événement `position` (celui déclenché par ce changement) pour
  // réorienter la caméra vers le même repère visuel. Cf. src/runtime/lib/lookAt.ts.
  const pendingLookAtTargetRef = React.useRef<LatLng | null>(null)

  // Dernière position connue (clic carte ou navigation Jakartowns), utilisée
  // en repli pour le bouton "Ouvrir dans Jakartowns" tant qu'aucune image
  // n'est encore chargée dans le viewer.
  const [currentPosition, setCurrentPosition] = React.useState<JakartoPosition | null>(null)
  const [currentDate, setCurrentDate] = React.useState<string | null>(null)
  const [currentImageId, setCurrentImageId] = React.useState<string | null>(null)
  const [availableImages, setAvailableImages] = React.useState<JakartoMultipassImage[]>([])

  const [isPickingEnabled, setIsPickingEnabled] = React.useState(false)
  const isPickingEnabledRef = React.useRef(false)

  const spatialSync = useSpatialSync()

  const onActiveViewChange = React.useCallback((view: JimuMapView) => {
    setJimuMapView(view)
  }, [])

  React.useEffect(() => {
    jimuMapViewRef.current = jimuMapView
  }, [jimuMapView])

  React.useEffect(() => {
    isPickingEnabledRef.current = isPickingEnabled
  }, [isPickingEnabled])

  // Reconnexion automatique si une clé API a déjà été validée sur ce
  // navigateur (cf. services/jakarto.ts — contourne le CORS bloquant sur
  // le endpoint de vérification de session).
  React.useEffect(() => {
    const storedApiKey = getStoredApiKey()
    if (!storedApiKey) return
    authenticate(storedApiKey).then((ok) => {
      if (ok) setIsAuthenticated(true)
    })
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
    setCurrentDate(null)
    setCurrentImageId(null)
    setAvailableImages([])
  }

  const handleSelectImage = (imageId: string) => {
    const handle = viewerHandleRef.current
    if (!handle) return

    // Avant de changer d'image, on retient un point ~20m devant la vue
    // actuelle : les images "au même endroit" ne sont pas forcément captées
    // exactement à la même position (voie différente, quelques mètres
    // d'écart), donc on essaie de garder le même repère visuel plutôt que de
    // juste réinitialiser l'orientation.
    const viewState = handle.getViewState()
    if (viewState.latitude != null && viewState.longitude != null && viewState.pan != null) {
      const currentBearing = reflectAngle(viewState.pan)
      pendingLookAtTargetRef.current = projectPoint(
        { lat: viewState.latitude, lng: viewState.longitude },
        currentBearing,
        LOOK_AHEAD_DISTANCE_METERS
      )
    } else {
      pendingLookAtTargetRef.current = null
    }

    handle.setImage(imageId)
  }

  const handleOpenInJakartowns = () => {
    const viewState = viewerHandleRef.current?.getViewState()
    const position = viewState?.latitude != null && viewState?.longitude != null
      ? { latitude: viewState.latitude, longitude: viewState.longitude }
      : currentPosition ?? { latitude: config.fallbackLatitude, longitude: config.fallbackLongitude }
    const url = buildJakartownsUrl(position, {
      uid: viewState?.imageId,
      pan: viewState?.pan,
      tilt: viewState?.tilt,
      fov: viewState?.fov
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Initialise le viewer Jakartowns une fois authentifié et le conteneur monté.
  React.useEffect(() => {
    if (!isAuthenticated || !viewerContainerRef.current) return

    let cancelled = false
    const view = jimuMapViewRef.current?.view
    const center = view?.center

    initializeViewer(viewerContainerRef.current, {
      latitude: center?.latitude ?? config.fallbackLatitude,
      longitude: center?.longitude ?? config.fallbackLongitude,
      onViewChange: (state) => {
        if (state.latitude != null && state.longitude != null) {
          const position = { latitude: state.latitude, longitude: state.longitude }
          setCurrentPosition(position)
          spatialSync.onJakartoNavigate(position, (p) => {
            const activeView = jimuMapViewRef.current?.view
            activeView?.goTo({ center: [p.longitude, p.latitude] }, { duration: 600 })
          })

          const pendingTarget = pendingLookAtTargetRef.current
          if (pendingTarget) {
            pendingLookAtTargetRef.current = null
            const newPan = getJakartownsPanTowards(position, pendingTarget)
            viewerHandleRef.current?.setPan(newPan)
          }
        }
        setCurrentDate(state.date)
        setCurrentImageId(state.imageId)
        setAvailableImages(state.availableImages)
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

  // Relaie vers le panorama Jakartowns : un clic gauche quand le mode
  // "pointage" est armé (désarmé automatiquement après usage), ou un clic
  // droit à tout moment (empêche le menu contextuel du navigateur).
  React.useEffect(() => {
    const view = jimuMapView?.view
    if (!view) return

    const triggerLocate = (mapPoint: { latitude: number, longitude: number } | null | undefined) => {
      if (!mapPoint) return
      const position = { latitude: mapPoint.latitude, longitude: mapPoint.longitude }
      setCurrentPosition(position)
      spatialSync.onMapClick(position, (p) => {
        viewerHandleRef.current?.setPosition(p)
      })
    }

    const clickHandle = view.on('click', (event) => {
      if (!isPickingEnabledRef.current) return
      triggerLocate(event.mapPoint)
      setIsPickingEnabled(false)
    })

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      const rect = view.container.getBoundingClientRect()
      const mapPoint = view.toMap({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      triggerLocate(mapPoint)
    }
    view.container?.addEventListener('contextmenu', onContextMenu)

    return () => {
      clickHandle.remove()
      view.container?.removeEventListener('contextmenu', onContextMenu)
    }
  }, [jimuMapView, spatialSync])

  const handleTitleBarPointerDown = (event: React.PointerEvent) => {
    const panel = panelRef.current
    const root = widgetRootRef.current
    if (!panel || !root) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const panelRect = panel.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: panelRect.left - rootRect.left,
      startTop: panelRect.top - rootRect.top,
      maxLeft: Math.max(0, rootRect.width - panelRect.width),
      maxTop: Math.max(0, rootRect.height - panelRect.height)
    }
  }

  const handleTitleBarPointerMove = (event: React.PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY
    setPanelPosition({
      left: Math.min(Math.max(0, drag.startLeft + dx), drag.maxLeft),
      top: Math.min(Math.max(0, drag.startTop + dy), drag.maxTop)
    })
  }

  const handleTitleBarPointerUp = (event: React.PointerEvent) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }
  }

  const handleResizeHandlePointerDown = (event: React.PointerEvent) => {
    const panel = panelRef.current
    const root = widgetRootRef.current
    if (!panel || !root) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const panelRect = panel.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
      maxWidth: Math.max(MIN_PANEL_WIDTH, rootRect.right - panelRect.left),
      maxHeight: Math.max(MIN_PANORAMA_HEIGHT, rootRect.bottom - panelRect.top)
    }
  }

  const handleResizeHandlePointerMove = (event: React.PointerEvent) => {
    const resize = resizeStateRef.current
    if (!resize || event.pointerId !== resize.pointerId) return
    const dx = event.clientX - resize.startClientX
    const dy = event.clientY - resize.startClientY
    setPanelSize({
      width: Math.min(Math.max(MIN_PANEL_WIDTH, resize.startWidth + dx), resize.maxWidth),
      height: Math.min(Math.max(MIN_PANORAMA_HEIGHT, resize.startHeight + dy), resize.maxHeight)
    })
  }

  const handleResizeHandlePointerUp = (event: React.PointerEvent) => {
    if (resizeStateRef.current?.pointerId === event.pointerId) {
      resizeStateRef.current = null
    }
  }

  const scrollTimeline = (direction: number) => {
    timelineListRef.current?.scrollBy({ left: direction * TIMELINE_SCROLL_STEP, behavior: 'smooth' })
  }

  // Toujours au moins l'image courante (même sans multipass), pour que la
  // date reste visible dans tous les cas — pas seulement quand plusieurs
  // captures existent au même endroit.
  const timelineEntries: JakartoMultipassImage[] = availableImages.length > 0
    ? availableImages
    : currentImageId != null
      ? [{ imageId: currentImageId, date: currentDate }]
      : []

  return (
    <div className="jakartowns-viewer-widget jimu-widget" ref={widgetRootRef}>
      {hasLinkedMap && (
        <JimuMapViewComponent
          useMapWidgetId={useMapWidgetIds[0]}
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
        <div
          className="jakartowns-viewer-panel"
          ref={panelRef}
          style={{
            width: panelSize.width,
            ...(panelPosition ? { left: panelPosition.left, top: panelPosition.top } : {})
          }}
        >
          <div
            className="jakartowns-viewer-panel-titlebar"
            onPointerDown={handleTitleBarPointerDown}
            onPointerMove={handleTitleBarPointerMove}
            onPointerUp={handleTitleBarPointerUp}
          >
            <span className="jakartowns-viewer-panel-title">Jakartowns</span>
            <div className="jakartowns-viewer-panel-titlebar-actions">
              {isAuthenticated && (
                <button
                  type="button"
                  className="jakartowns-viewer-icon-btn"
                  title={defaultMessages.logoutButton}
                  onClick={handleLogout}
                >
                  <IconLogout />
                </button>
              )}
              <button
                type="button"
                className="jakartowns-viewer-icon-btn"
                title={isPanelFolded ? defaultMessages.unfoldPanel : defaultMessages.foldPanel}
                onClick={() => setIsPanelFolded((folded) => !folded)}
              >
                <IconChevron folded={isPanelFolded} />
              </button>
            </div>
          </div>

          {!isPanelFolded && (
            <div className="jakartowns-viewer-panel-body">
              <div className="jakartowns-viewer-panel-toolbar">
                <button
                  type="button"
                  className="jakartowns-viewer-toolbar-btn"
                  aria-pressed={isPickingEnabled}
                  title={defaultMessages.pickingModeHint}
                  onClick={() => setIsPickingEnabled((enabled) => !enabled)}
                >
                  <IconTarget />
                  {defaultMessages.pickingModeLabel}
                </button>
                <button
                  type="button"
                  className="jakartowns-viewer-toolbar-btn"
                  title={defaultMessages.openInJakartownsLink}
                  onClick={handleOpenInJakartowns}
                  disabled={!currentImageId}
                >
                  <IconExternalLink />
                  {defaultMessages.openInJakartownsLink}
                </button>
              </div>

              {!isAuthenticated && (
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

              {isAuthenticated && (
                <div className="jakartowns-viewer-panorama-area" style={{ height: panelSize.height }}>
                  <div ref={viewerContainerRef} className="jakartowns-viewer-panorama" />

                  {timelineEntries.length > 0 && (
                    <div className="jakartowns-viewer-timeline">
                      <button
                        type="button"
                        className="jakartowns-viewer-timeline-arrow"
                        aria-label={defaultMessages.timelineScrollPrevious}
                        onClick={() => scrollTimeline(-1)}
                      >
                        ‹
                      </button>
                      <div className="jakartowns-viewer-timeline-list" ref={timelineListRef}>
                        {timelineEntries.map((image) => (
                          <button
                            key={image.imageId}
                            type="button"
                            className={
                              'jakartowns-viewer-multipass-chip' +
                              (image.imageId === currentImageId ? ' is-selected' : '')
                            }
                            onClick={() => handleSelectImage(image.imageId)}
                          >
                            {formatJakartoDate(image.date) ?? defaultMessages.multipassUnknownDate}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="jakartowns-viewer-timeline-arrow"
                        aria-label={defaultMessages.timelineScrollNext}
                        onClick={() => scrollTimeline(1)}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isPanelFolded && (
            <div
              className="jakartowns-viewer-resize-handle"
              onPointerDown={handleResizeHandlePointerDown}
              onPointerMove={handleResizeHandlePointerMove}
              onPointerUp={handleResizeHandlePointerUp}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default Widget
