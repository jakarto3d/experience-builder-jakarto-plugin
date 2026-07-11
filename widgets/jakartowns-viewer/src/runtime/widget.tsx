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

// panelSize.height est la hauteur TOTALE du panneau (barre de titre incluse),
// pas seulement celle du panorama : la barre de titre garde toujours sa
// taille naturelle (flex-shrink: 0 en CSS) et le panorama se partage le
// reste via flex:1, donc aucun calcul manuel de soustraction n'est
// nécessaire ici — la barre de titre et le fil des dates ne peuvent plus
// disparaître à cause d'une erreur d'arithmétique sur la hauteur.
const DEFAULT_PANEL_WIDTH = 380
const DEFAULT_PANEL_HEIGHT = 360
const MIN_PANEL_WIDTH = 260
const MIN_PANEL_HEIGHT = 220
const TIMELINE_SCROLL_STEP = 160
const PANEL_MARGIN = 12
// Arrondi du fov avant de régénérer l'icône (évite de reconstruire le SVG à
// chaque micro-variation de zoom dans le panorama) — même principe que
// JKTOWNS_FOV_PRECISION dans l'implémentation de référence.
const OBSERVER_FOV_PRECISION = 2

/**
 * Convertit le pan Jakartowns (0 = Nord, sens antihoraire — voir
 * buildJakartownsUrl) en un angle de rotation pour un symbole ArcGIS
 * (`PictureMarkerSymbol.angle`), exprimé en degrés sens horaire depuis le
 * Nord — même convention que `heading` sur l'ObserverIcon de jakui (voir
 * lib/observerIcon.ts), confirmée par sa documentation de props ("0 points
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
  /** -1 = poignée à gauche (déplace + redimensionne), 1 = à droite (redimensionne seulement), 0 = pas concerné par cet axe. */
  directionX: -1 | 0 | 1
  /** Idem verticalement : -1 = en haut, 1 = en bas. */
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

const IconGear = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  // Tant que l'utilisateur n'a pas lui-même déplacé/redimensionné le
  // panneau, celui-ci occupe tout l'espace disponible du widget par défaut.
  const hasCustomSizeRef = React.useRef(false)
  const [panelPosition, setPanelPosition] = React.useState<PanelPosition | null>(null)
  const [panelSize, setPanelSize] = React.useState<PanelSize>({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT })
  const [isPanelFolded, setIsPanelFolded] = React.useState(false)

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const jimuMapViewRef = React.useRef<JimuMapView>(null)

  // Par défaut, le panneau occupe tout l'espace disponible du widget plutôt
  // qu'une petite taille fixe — jusqu'à ce que l'utilisateur le déplace ou
  // le redimensionne lui-même (cf. hasCustomSizeRef), après quoi son choix
  // est respecté même si le widget change de taille. Dépend de `jimuMapView`
  // (pas `[]`) : le panneau n'existe dans le DOM qu'une fois la carte liée
  // active, donc un effet à dépendances vides s'exécuterait avant que
  // `panelRef` soit renseigné et ne se redéclencherait jamais.
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
  // Couvre le bouton engrenage ET le popover (pas juste le popover) : sinon
  // cliquer sur le bouton lui-même pendant que le popover est ouvert compte
  // comme un "clic en dehors" au pointerdown (le fermant), puis le click qui
  // suit sur le bouton le rouvre aussitôt via le toggle — au final il ne se
  // fermait jamais vraiment en cliquant dessus.
  const settingsAnchorRef = React.useRef<HTMLDivElement>(null)

  // Dernière position connue (clic carte ou navigation Jakartowns), utilisée
  // en repli pour le bouton "Ouvrir dans Jakartowns" tant qu'aucune image
  // n'est encore chargée dans le viewer.
  const [currentPosition, setCurrentPosition] = React.useState<JakartoPosition | null>(null)
  const [currentDate, setCurrentDate] = React.useState<string | null>(null)
  const [currentImageId, setCurrentImageId] = React.useState<string | null>(null)
  const [availableImages, setAvailableImages] = React.useState<JakartoMultipassImage[]>([])

  const [isPickingEnabled, setIsPickingEnabled] = React.useState(false)
  const isPickingEnabledRef = React.useRef(false)

  // Indicateur de position/orientation sur la carte liée (voir l'effet plus
  // bas). arcgisModulesRef garde Graphic pour ne le charger qu'une fois ;
  // positionGraphicRef est le graphic unique qu'on repositionne/réoriente au
  // lieu d'en recréer un à chaque mise à jour. L'icône (SVG en data-URL)
  // n'est régénérée que si le fov (arrondi) a changé — le cap se règle
  // séparément via l'angle du symbole, sans toucher à l'image.
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

  // Ferme le popover de réglages au clic en dehors.
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

  // Crée la couche accueillant l'indicateur de position/orientation, une
  // fois par vue de carte. Ne dépend d'aucune donnée Jakarto (juste
  // GraphicsLayer/Graphic d'ArcGIS) : pas de souci d'auth cross-origin ici,
  // contrairement à la couche jakman (retirée).
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

  // Déplace/réoriente le graphic existant plutôt que d'en recréer un à
  // chaque appel (moins coûteux, utile vu la fréquence des événements
  // `rotation`/`fov`). L'icône (image SVG) n'est régénérée que si le fov
  // arrondi a changé ; le cap se règle via `symbol.angle` uniquement.
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

  // Initialise le viewer Jakartowns une fois authentifié et le conteneur monté.
  React.useEffect(() => {
    if (!isAuthenticated || !viewerContainerRef.current) return

    let cancelled = false

    // Ne charge aucun panorama par défaut : sans repère fiable de l'endroit
    // où Jakarto a des données (le centre de la carte ou une position de
    // repli arbitraire peuvent tomber loin de toute couverture), Jakartowns
    // semblait "téléporter" la vue vers le point de données disponible le
    // plus proche (observé : bien à l'ouest de l'Ontario, la donnée la plus
    // à l'ouest de Jakarto) — déroutant, et source probable du fil des
    // dates resté vide au premier chargement. On ne passe une position
    // initiale que si l'utilisateur en a déjà choisi une dans cette session
    // (ex. déconnexion/reconnexion après un premier clic) ; sinon le viewer
    // se monte "vide" jusqu'au premier clic sur la carte (mode pointage ou
    // clic droit).
    initializeViewer(viewerContainerRef.current, {
      ...(currentPosition ? { latitude: currentPosition.latitude, longitude: currentPosition.longitude } : {}),
      // Ne recentre plus la carte au changement d'image/position dans le
      // panorama (comportement jugé trop intrusif) : seul l'indicateur sur
      // la carte se met à jour, la vue de l'utilisateur reste sous son
      // contrôle.
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

  // Relaie vers le panorama Jakartowns : un clic gauche quand le mode
  // "pointage" est armé (désarmé automatiquement après usage), ou un clic
  // droit — seulement si l'utilisateur l'a explicitement activé dans les
  // réglages (désactivé par défaut : peut entrer en conflit avec un
  // comportement par défaut de l'application hôte).
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
    // Sans ce garde-fou, cliquer sur un bouton de la barre de titre (déconnexion,
    // replier) démarre quand même un glisser-déposer : le pointerdown remonte
    // (bubbling) jusqu'ici, setPointerCapture capture le pointeur sur la barre de
    // titre, et le click du bouton ne se déclenche alors plus jamais.
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

  // Toujours au moins l'image courante (même sans multipass), pour que la
  // date reste visible dans tous les cas — pas seulement quand plusieurs
  // captures existent au même endroit.
  const timelineEntries: JakartoMultipassImage[] = availableImages.length > 0
    ? availableImages
    : currentImageId != null
      ? [{ imageId: currentImageId, date: currentDate }]
      : []

  // Désactive les flèches quand le fil des dates tient déjà dans l'espace
  // disponible (rien à faire défiler).
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
            // Pas de hauteur imposée quand replié : le panneau doit pouvoir
            // reprendre sa taille naturelle (juste la barre de titre) au
            // lieu de garder la hauteur dépliée avec un grand vide en
            // dessous (panel-body passe en display:none, mais une hauteur
            // fixée en inline style ne s'ajuste pas toute seule au contenu).
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
            Masqué en CSS (pas démonté du JSX) quand replié : le conteneur
            du panorama ci-dessous héberge le canvas WebGL de Jakartowns,
            monté une seule fois par initializeViewer. Le démonter puis le
            remonter (via un rendu conditionnel) casse ce canvas —
            Jakartowns ne le recrée pas tout seul dans une nouvelle div vide.
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

          {!isPanelFolded && (
            <>
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-n"
                onPointerDown={handleResizeHandlePointerDown(0, -1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-s"
                onPointerDown={handleResizeHandlePointerDown(0, 1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-e"
                onPointerDown={handleResizeHandlePointerDown(1, 0)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-w"
                onPointerDown={handleResizeHandlePointerDown(-1, 0)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-ne"
                onPointerDown={handleResizeHandlePointerDown(1, -1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-nw"
                onPointerDown={handleResizeHandlePointerDown(-1, -1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-se"
                onPointerDown={handleResizeHandlePointerDown(1, 1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
              <div
                className="jakartowns-viewer-resize-handle jakartowns-viewer-resize-handle-sw"
                onPointerDown={handleResizeHandlePointerDown(-1, 1)}
                onPointerMove={handleResizeHandlePointerMove}
                onPointerUp={handleResizeHandlePointerUp}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Widget
