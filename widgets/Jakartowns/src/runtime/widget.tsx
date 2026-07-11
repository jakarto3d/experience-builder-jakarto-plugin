import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, loadArcGISJSAPIModules, type JimuMapView } from 'jimu-arcgis'
import { type IMConfig } from '../config'
import {
  getStoredApiKey,
  authenticate,
  logout,
  initializeViewer,
  buildJakartownsUrl,
  getStoredSettings,
  storeSettings,
  type JakartoPosition,
  type JakartoViewerHandle,
  type JakartoMultipassImage,
  type JakartoWidgetSettings
} from './services/jakarto'
import { buildObserverIconDataUrl, OBSERVER_ICON_SIZE, DEFAULT_OBSERVER_FOV } from './lib/observerIcon'
import defaultMessages from './translations/default'
import './widget.css'

// panelSize.height is the panel's TOTAL height (title bar included), not
// just the panorama's: the title bar always keeps its natural size
// (flex-shrink: 0 in CSS) and the panorama shares the rest via flex:1, so no
// manual subtraction is needed here — the title bar and the date timeline
// can no longer disappear because of a height arithmetic mistake.
const DEFAULT_PANEL_WIDTH = 380
const DEFAULT_PANEL_HEIGHT = 360
const MIN_PANEL_WIDTH = 260
const MIN_PANEL_HEIGHT = 220
const TIMELINE_SCROLL_STEP = 160
const PANEL_MARGIN = 12
// Rounds the fov before regenerating the icon (avoids rebuilding the SVG on
// every micro-variation of zoom inside the panorama) — same principle as
// JKTOWNS_FOV_PRECISION in the reference implementation.
const OBSERVER_FOV_PRECISION = 2

/**
 * The 8 resize handles (4 edges + 4 corners) only differ by their CSS class
 * suffix and the axis they affect — described here as data instead of
 * duplicated in JSX (see the render below).
 */
const RESIZE_HANDLE_DIRECTIONS: ReadonlyArray<{
  cssSuffix: string
  directionX: -1 | 0 | 1
  directionY: -1 | 0 | 1
}> = [
  { cssSuffix: 'n', directionX: 0, directionY: -1 },
  { cssSuffix: 's', directionX: 0, directionY: 1 },
  { cssSuffix: 'e', directionX: 1, directionY: 0 },
  { cssSuffix: 'w', directionX: -1, directionY: 0 },
  { cssSuffix: 'ne', directionX: 1, directionY: -1 },
  { cssSuffix: 'nw', directionX: -1, directionY: -1 },
  { cssSuffix: 'se', directionX: 1, directionY: 1 },
  { cssSuffix: 'sw', directionX: -1, directionY: 1 }
]

/**
 * Converts the Jakartowns pan (0 = North, counter-clockwise — see
 * buildJakartownsUrl) into a rotation angle for an ArcGIS symbol
 * (`PictureMarkerSymbol.angle`), expressed in degrees clockwise from
 * North — same convention as `heading` on jakui's ObserverIcon (see
 * lib/observerIcon.ts), confirmed by its props documentation ("0 points
 * up, positive values rotate clockwise").
 */
function jakartownsPanToMarkerAngle(panRadians: number): number {
  const degrees = 360 - (panRadians * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

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
  startLeft: number
  startTop: number
  startWidth: number
  startHeight: number
  /** -1 = handle on the left (moves + resizes), 1 = on the right (resizes only), 0 = not involved on this axis. */
  directionX: -1 | 0 | 1
  /** Same vertically: -1 = top, 1 = bottom. */
  directionY: -1 | 0 | 1
  rootWidth: number
  rootHeight: number
}

interface PanelPosition {
  left: number
  top: number
}

interface PanelSize {
  width: number
  height: number
}

// Wrapper shared by all title-bar icons: same viewBox/size/stroke for all of
// them, only the content (<path>/<circle>) changes from one icon to another.
const ICON_VIEWBOX_SIZE = 24
const ICON_DISPLAY_SIZE = 14
const ICON_STROKE_WIDTH = 2

const IconBase = ({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) => (
  <svg viewBox={`0 0 ${ICON_VIEWBOX_SIZE} ${ICON_VIEWBOX_SIZE}`} width={ICON_DISPLAY_SIZE} height={ICON_DISPLAY_SIZE}
    fill="none" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </svg>
)

const IconChevron = ({ folded }: { folded: boolean }) => (
  <IconBase style={{ transform: folded ? 'rotate(180deg)' : 'none' }}>
    <path d="M18 15l-6-6-6 6" />
  </IconBase>
)

const IconLogout = () => (
  <IconBase>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </IconBase>
)

const IconTarget = () => (
  <IconBase>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </IconBase>
)

const IconExternalLink = () => (
  <IconBase>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
  </IconBase>
)

const IconGear = () => (
  <IconBase>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </IconBase>
)

function formatJakartoDate(dateString: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

/**
 * "Jakartowns Viewer" widget.
 *
 * Binds to the Map widget chosen in settings (useMapWidgetIds) and shows
 * the Jakartowns panorama in a floating panel that can be folded, dragged,
 * and resized (within the widget's bounds). Two ways to point at a
 * location on the linked map:
 *   - "picking" mode armed via the dedicated button: the next left click
 *     locates and then disarms itself automatically (one-off use)
 *   - right click on the map: always active, no need to arm anything
 * Navigating inside the panorama recenters the map the other way around.
 */
const Widget = (props: AllWidgetProps<IMConfig>) => {
  const { useMapWidgetIds, config } = props
  const hasLinkedMap = !!(useMapWidgetIds && useMapWidgetIds.length > 0)

  const widgetRootRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const dragStateRef = React.useRef<DragState | null>(null)
  const resizeStateRef = React.useRef<ResizeState | null>(null)
  // As long as the user hasn't moved/resized the panel themselves, it
  // occupies all the widget's available space by default.
  const hasCustomSizeRef = React.useRef(false)
  const [panelPosition, setPanelPosition] = React.useState<PanelPosition | null>(null)
  const [panelSize, setPanelSize] = React.useState<PanelSize>({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT })
  const [isPanelFolded, setIsPanelFolded] = React.useState(false)

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const jimuMapViewRef = React.useRef<JimuMapView>(null)

  // By default, the panel occupies all the widget's available space rather
  // than a small fixed size — until the user drags or resizes it themselves
  // (see hasCustomSizeRef), after which their choice is respected even if
  // the widget changes size. Depends on `jimuMapView` (not `[]`): the panel
  // only exists in the DOM once the linked map is active, so an effect with
  // empty dependencies would run before `panelRef` is set and would never
  // re-run afterward.
  React.useLayoutEffect(() => {
    const root = widgetRootRef.current
    const panel = panelRef.current
    if (!root || !panel) return

    const applyDefaultFullSize = () => {
      if (hasCustomSizeRef.current) return
      const rootRect = root.getBoundingClientRect()
      setPanelPosition({ left: PANEL_MARGIN, top: PANEL_MARGIN })
      setPanelSize({
        width: Math.max(MIN_PANEL_WIDTH, rootRect.width - PANEL_MARGIN * 2),
        height: Math.max(MIN_PANEL_HEIGHT, rootRect.height - PANEL_MARGIN * 2)
      })
    }

    applyDefaultFullSize()
    const observer = new ResizeObserver(applyDefaultFullSize)
    observer.observe(root)
    return () => observer.disconnect()
  }, [jimuMapView])

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [authLoading, setAuthLoading] = React.useState(false)

  const viewerContainerRef = React.useRef<HTMLDivElement>(null)
  const viewerHandleRef = React.useRef<JakartoViewerHandle>(null)
  const timelineListRef = React.useRef<HTMLDivElement>(null)

  const [settings, setSettings] = React.useState<JakartoWidgetSettings>(() => getStoredSettings())
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  // Covers the gear button AND the popover (not just the popover): otherwise
  // clicking the button itself while the popover is open counts as an
  // "outside click" on pointerdown (closing it), then the click that follows
  // on the button reopens it right away via the toggle — it would never
  // actually close when clicking on it.
  const settingsAnchorRef = React.useRef<HTMLDivElement>(null)

  // Last known position (map click or Jakartowns navigation), used as a
  // fallback for the "Open in Jakartowns" button as long as no image is
  // loaded in the viewer yet.
  const [currentPosition, setCurrentPosition] = React.useState<JakartoPosition | null>(null)
  const [currentDate, setCurrentDate] = React.useState<string | null>(null)
  const [currentImageId, setCurrentImageId] = React.useState<string | null>(null)
  const [availableImages, setAvailableImages] = React.useState<JakartoMultipassImage[]>([])

  const [isPickingEnabled, setIsPickingEnabled] = React.useState(false)
  const isPickingEnabledRef = React.useRef(false)

  // Position/orientation indicator on the linked map (see the effect
  // further down). arcgisModulesRef holds Graphic so it's only loaded once;
  // positionGraphicRef is the single graphic that gets repositioned/
  // reoriented instead of being recreated on every update. The icon (SVG as
  // a data URL) is only regenerated if the (rounded) fov has changed — the
  // heading is set separately via the symbol's angle, without touching the
  // image.
  const arcgisModulesRef = React.useRef<{ Graphic: any } | null>(null)
  const positionGraphicsLayerRef = React.useRef<any>(null)
  const positionGraphicRef = React.useRef<any>(null)
  const lastKnownPositionRef = React.useRef<JakartoPosition | null>(null)
  const observerIconUrlRef = React.useRef<string | null>(null)
  const observerIconFovRef = React.useRef<number | null>(null)

  const onActiveViewChange = React.useCallback((view: JimuMapView) => {
    setJimuMapView(view)
  }, [])

  React.useEffect(() => {
    jimuMapViewRef.current = jimuMapView
  }, [jimuMapView])

  React.useEffect(() => {
    isPickingEnabledRef.current = isPickingEnabled
  }, [isPickingEnabled])

  React.useEffect(() => {
    if (!isSettingsOpen) return
    const onPointerDownOutside = (event: PointerEvent) => {
      if (!settingsAnchorRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    return () => document.removeEventListener('pointerdown', onPointerDownOutside)
  }, [isSettingsOpen])

  const handleToggleRightClickSetting = (checked: boolean) => {
    const next = { ...settings, rightClickToLocate: checked }
    setSettings(next)
    storeSettings(next)
  }

  // Automatic reconnection if an API key has already been validated on
  // this browser (see services/jakarto.ts — works around the CORS
  // restriction on the session-check endpoint).
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
    viewerHandleRef.current?.setImage(imageId)
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

  // Creates the layer hosting the position/orientation indicator, once per
  // map view. Doesn't depend on any Jakarto data (just ArcGIS's
  // GraphicsLayer/Graphic): no cross-origin auth concern here, unlike the
  // (removed) jakman layer.
  React.useEffect(() => {
    const view = jimuMapView?.view
    if (!view) return

    let cancelled = false
    loadArcGISJSAPIModules(['esri/layers/GraphicsLayer', 'esri/Graphic']).then(([GraphicsLayer, Graphic]) => {
      if (cancelled) return
      arcgisModulesRef.current = { Graphic }
      const layer = new GraphicsLayer({ listMode: 'hide' })
      positionGraphicsLayerRef.current = layer
      view.map.add(layer)
    })

    return () => {
      cancelled = true
      if (positionGraphicsLayerRef.current) {
        view.map.remove(positionGraphicsLayerRef.current)
        positionGraphicsLayerRef.current = null
      }
      positionGraphicRef.current = null
    }
  }, [jimuMapView])

  // Moves/reorients the existing graphic instead of recreating one on every
  // call (cheaper, useful given how frequent `rotation`/`fov` events are).
  // The icon (SVG image) is only regenerated if the rounded fov changed;
  // the heading is set via `symbol.angle` only.
  const updatePositionMarker = React.useCallback((
    position: JakartoPosition,
    panRadians: number | null,
    fovDegrees: number | null
  ) => {
    const modules = arcgisModulesRef.current
    const layer = positionGraphicsLayerRef.current
    if (!modules || !layer) return

    const roundedFov = fovDegrees != null
      ? Math.round(fovDegrees * OBSERVER_FOV_PRECISION) / OBSERVER_FOV_PRECISION
      : DEFAULT_OBSERVER_FOV
    if (observerIconUrlRef.current == null || observerIconFovRef.current !== roundedFov) {
      observerIconUrlRef.current = buildObserverIconDataUrl(roundedFov)
      observerIconFovRef.current = roundedFov
    }

    const symbol = {
      type: 'picture-marker',
      url: observerIconUrlRef.current,
      width: `${OBSERVER_ICON_SIZE}px`,
      height: `${OBSERVER_ICON_SIZE}px`,
      angle: panRadians != null ? jakartownsPanToMarkerAngle(panRadians) : 0
    }
    const geometry = { type: 'point', latitude: position.latitude, longitude: position.longitude }

    if (positionGraphicRef.current) {
      positionGraphicRef.current.geometry = geometry
      positionGraphicRef.current.symbol = symbol
    } else {
      const graphic = new modules.Graphic({ geometry, symbol })
      positionGraphicRef.current = graphic
      layer.add(graphic)
    }
  }, [])

  // Initializes the Jakartowns viewer once authenticated and the container is mounted.
  React.useEffect(() => {
    if (!isAuthenticated || !viewerContainerRef.current) return

    let cancelled = false

    // Loads no panorama by default: without a reliable landmark for where
    // Jakarto has data (the map's center or an arbitrary fallback position
    // could land far from any coverage), Jakartowns seemed to "teleport"
    // the view to the nearest available data point (observed: far west in
    // Ontario, Jakarto's westernmost data) — confusing, and the likely
    // cause of the date timeline staying empty on first load. An initial
    // position is only passed if the user already picked one during this
    // session (e.g. logout/login after a first click); otherwise the
    // viewer mounts "empty" until the first click on the map (picking mode
    // or right click).
    initializeViewer(viewerContainerRef.current, {
      ...(currentPosition ? { latitude: currentPosition.latitude, longitude: currentPosition.longitude } : {}),
      // No longer recenters the map when the image/position changes inside
      // the panorama (deemed too intrusive): only the indicator on the map
      // updates, the user's view stays under their control.
      onViewChange: (state) => {
        if (state.latitude != null && state.longitude != null) {
          const position = { latitude: state.latitude, longitude: state.longitude }
          setCurrentPosition(position)
          lastKnownPositionRef.current = position
          updatePositionMarker(position, state.pan, state.fov)
        }
        setCurrentDate(state.date)
        setCurrentImageId(state.imageId)
        setAvailableImages(state.availableImages)
      },
      onOrientationChange: (pan, fov) => {
        if (lastKnownPositionRef.current) {
          updatePositionMarker(lastKnownPositionRef.current, pan, fov)
        }
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

  // Relays to the Jakartowns panorama: a left click when "picking" mode is
  // armed (auto-disarmed after use), or a right click — only if the user
  // explicitly enabled it in settings (disabled by default: can conflict
  // with a default behavior of the host application).
  React.useEffect(() => {
    const view = jimuMapView?.view
    if (!view) return

    const triggerLocate = (mapPoint: { latitude: number, longitude: number } | null | undefined) => {
      if (!mapPoint) return
      const position = { latitude: mapPoint.latitude, longitude: mapPoint.longitude }
      setCurrentPosition(position)
      viewerHandleRef.current?.setPosition(position)
    }

    const clickHandle = view.on('click', (event) => {
      if (!isPickingEnabledRef.current) return
      triggerLocate(event.mapPoint)
      setIsPickingEnabled(false)
    })

    const onContextMenu = (event: MouseEvent) => {
      if (!settings.rightClickToLocate) return
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
  }, [jimuMapView, settings.rightClickToLocate])

  const handleTitleBarPointerDown = (event: React.PointerEvent) => {
    // Without this guard, clicking a title-bar button (logout, fold) would still
    // start a drag: the pointerdown bubbles up here, setPointerCapture grabs the
    // pointer on the title bar, and the button's click event never fires.
    if ((event.target as HTMLElement).closest('button, input, label, .jakartowns-viewer-settings-popover')) return
    const panel = panelRef.current
    const root = widgetRootRef.current
    if (!panel || !root) return
    hasCustomSizeRef.current = true
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

  const handleResizeHandlePointerDown = (directionX: -1 | 0 | 1, directionY: -1 | 0 | 1) =>
    (event: React.PointerEvent) => {
      const panel = panelRef.current
      const root = widgetRootRef.current
      if (!panel || !root) return
      hasCustomSizeRef.current = true
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      const panelRect = panel.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      resizeStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: panelRect.left - rootRect.left,
        startTop: panelRect.top - rootRect.top,
        startWidth: panelSize.width,
        startHeight: panelSize.height,
        directionX,
        directionY,
        rootWidth: rootRect.width,
        rootHeight: rootRect.height
      }
    }

  const handleResizeHandlePointerMove = (event: React.PointerEvent) => {
    const resize = resizeStateRef.current
    if (!resize || event.pointerId !== resize.pointerId) return
    const dx = event.clientX - resize.startClientX
    const dy = event.clientY - resize.startClientY

    let width = resize.startWidth
    let left = resize.startLeft
    if (resize.directionX === 1) {
      width = Math.min(Math.max(MIN_PANEL_WIDTH, resize.startWidth + dx), resize.rootWidth - resize.startLeft)
    } else if (resize.directionX === -1) {
      width = Math.min(Math.max(MIN_PANEL_WIDTH, resize.startWidth - dx), resize.startLeft + resize.startWidth)
      left = Math.max(0, resize.startLeft + (resize.startWidth - width))
    }

    let height = resize.startHeight
    let top = resize.startTop
    if (resize.directionY === 1) {
      height = Math.min(Math.max(MIN_PANEL_HEIGHT, resize.startHeight + dy), resize.rootHeight - resize.startTop)
    } else if (resize.directionY === -1) {
      height = Math.min(Math.max(MIN_PANEL_HEIGHT, resize.startHeight - dy), resize.startTop + resize.startHeight)
      top = Math.max(0, resize.startTop + (resize.startHeight - height))
    }

    setPanelSize({ width, height })
    if (resize.directionX === -1 || resize.directionY === -1) {
      setPanelPosition({ left, top })
    }
  }

  const handleResizeHandlePointerUp = (event: React.PointerEvent) => {
    if (resizeStateRef.current?.pointerId === event.pointerId) {
      resizeStateRef.current = null
    }
  }

  const scrollTimeline = (direction: number) => {
    timelineListRef.current?.scrollBy({ left: direction * TIMELINE_SCROLL_STEP, behavior: 'smooth' })
  }

  // Always at least the current image (even without multipass), so the
  // date stays visible in every case — not just when several captures
  // exist at the same spot.
  const timelineEntries: JakartoMultipassImage[] = availableImages.length > 0
    ? availableImages
    : currentImageId != null
      ? [{ imageId: currentImageId, date: currentDate }]
      : []

  const [canScrollTimeline, setCanScrollTimeline] = React.useState(false)

  const updateCanScrollTimeline = React.useCallback(() => {
    const el = timelineListRef.current
    setCanScrollTimeline(!!el && el.scrollWidth > el.clientWidth + 1)
  }, [])

  React.useEffect(() => {
    updateCanScrollTimeline()
  }, [timelineEntries, panelSize.width, updateCanScrollTimeline])

  React.useEffect(() => {
    const el = timelineListRef.current
    if (!el) return
    const observer = new ResizeObserver(updateCanScrollTimeline)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateCanScrollTimeline])

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
            // No height forced when folded: the panel must fall back to its
            // natural size (just the title bar) instead of keeping the
            // unfolded height with a big empty gap below (panel-body
            // switches to display:none, but an inline-styled height doesn't
            // shrink to fit its content on its own).
            ...(isPanelFolded ? {} : { height: panelSize.height }),
            ...(panelPosition ? { left: panelPosition.left, top: panelPosition.top } : {})
          }}
        >
          <div
            className="jakartowns-viewer-panel-titlebar"
            onPointerDown={handleTitleBarPointerDown}
            onPointerMove={handleTitleBarPointerMove}
            onPointerUp={handleTitleBarPointerUp}
          >
            <div className="jakartowns-viewer-panel-titlebar-start">
              <span className="jakartowns-viewer-panel-title">Jakartowns</span>
            </div>

            <div className="jakartowns-viewer-panel-titlebar-center">
              <button
                type="button"
                className="jakartowns-viewer-picking-btn"
                aria-pressed={isPickingEnabled}
                title={defaultMessages.pickingModeHint}
                onClick={() => setIsPickingEnabled((enabled) => !enabled)}
              >
                <IconTarget />
                <span>{defaultMessages.pickingModeLabel}</span>
              </button>
              <button
                type="button"
                className="jakartowns-viewer-icon-btn"
                title={defaultMessages.openInJakartownsLink}
                onClick={handleOpenInJakartowns}
                disabled={!currentImageId}
              >
                <IconExternalLink />
              </button>
            </div>

            <div className="jakartowns-viewer-panel-titlebar-end">
              <div className="jakartowns-viewer-settings-anchor" ref={settingsAnchorRef}>
                <button
                  type="button"
                  className="jakartowns-viewer-icon-btn"
                  aria-pressed={isSettingsOpen}
                  title={defaultMessages.settingsLabel}
                  onClick={() => setIsSettingsOpen((open) => !open)}
                >
                  <IconGear />
                </button>
                {isSettingsOpen && (
                  <div className="jakartowns-viewer-settings-popover">
                    <label className="jakartowns-viewer-settings-row">
                      <input
                        type="checkbox"
                        checked={settings.rightClickToLocate}
                        onChange={(e) => handleToggleRightClickSetting(e.target.checked)}
                      />
                      {defaultMessages.settingsRightClickLabel}
                    </label>
                  </div>
                )}
              </div>
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

          {/*
            Hidden via CSS (not unmounted from the JSX) when folded: the
            panorama container below hosts Jakartowns' WebGL canvas, mounted
            once by initializeViewer. Unmounting then remounting it (via
            conditional rendering) breaks that canvas — Jakartowns doesn't
            recreate it on its own in a new empty div.
          */}
          <div className={'jakartowns-viewer-panel-body' + (isPanelFolded ? ' jakartowns-viewer-panel-body--hidden' : '')}>
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
              <div className="jakartowns-viewer-panorama-area">
                <div ref={viewerContainerRef} className="jakartowns-viewer-panorama" />

                {!currentImageId && (
                  <div className="jakartowns-viewer-panorama-waiting">
                    {defaultMessages.panoramaWaitingForPick}
                  </div>
                )}

                {timelineEntries.length > 0 && (
                  <div className="jakartowns-viewer-timeline">
                    <button
                      type="button"
                      className="jakartowns-viewer-timeline-arrow"
                      aria-label={defaultMessages.timelineScrollPrevious}
                      onClick={() => scrollTimeline(-1)}
                      disabled={!canScrollTimeline}
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
                      disabled={!canScrollTimeline}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPanelFolded && RESIZE_HANDLE_DIRECTIONS.map(({ cssSuffix, directionX, directionY }) => (
            <div
              key={cssSuffix}
              className={`jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-${cssSuffix}`}
              onPointerDown={handleResizeHandlePointerDown(directionX, directionY)}
              onPointerMove={handleResizeHandlePointerMove}
              onPointerUp={handleResizeHandlePointerUp}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Widget
