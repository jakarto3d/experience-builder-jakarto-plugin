/**
 * Pure geometry math for the floating panel's drag/resize/default-size
 * behavior — extracted from widget.tsx so it can be unit tested without any
 * jimu/ArcGIS/DOM dependency. widget.tsx keeps ownership of *when* to call
 * these and *whether/what* to set as React state; this module only computes
 * numbers.
 */

export interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
  maxLeft: number
  maxTop: number
}

export interface ResizeState {
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

export interface PanelPosition {
  left: number
  top: number
}

export interface PanelSize {
  width: number
  height: number
}

/**
 * The 8 resize handles (4 edges + 4 corners) only differ by their CSS class
 * suffix and the axis they affect — described here as data instead of
 * duplicated in JSX.
 */
export const RESIZE_HANDLE_DIRECTIONS: ReadonlyArray<{
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

/** Full-size layout the panel occupies by default (until the user drags/resizes it themselves). */
export function computeDefaultFullSize(
  rootRect: { width: number, height: number },
  options: { margin: number, minWidth: number, minHeight: number }
): { position: PanelPosition, size: PanelSize } {
  const { margin, minWidth, minHeight } = options
  return {
    position: { left: margin, top: margin },
    size: {
      width: Math.max(minWidth, rootRect.width - margin * 2),
      height: Math.max(minHeight, rootRect.height - margin * 2)
    }
  }
}

/** Clamped panel position while dragging the title bar. */
export function computeDragPosition(drag: DragState, clientX: number, clientY: number): PanelPosition {
  const dx = clientX - drag.startClientX
  const dy = clientY - drag.startClientY
  return {
    left: Math.min(Math.max(0, drag.startLeft + dx), drag.maxLeft),
    top: Math.min(Math.max(0, drag.startTop + dy), drag.maxTop)
  }
}

/**
 * Clamped size/position while dragging a resize handle. Always returns both
 * `size` and `position`; the caller decides whether `position` actually
 * needs to be applied (only left/top-side handles move the panel — see
 * widget.tsx, which only calls setPanelPosition when
 * `directionX === -1 || directionY === -1`, matching the original
 * behavior).
 */
export function computeResize(
  resize: ResizeState,
  clientX: number,
  clientY: number,
  options: { minWidth: number, minHeight: number }
): { size: PanelSize, position: PanelPosition } {
  const { minWidth, minHeight } = options
  const dx = clientX - resize.startClientX
  const dy = clientY - resize.startClientY

  let width = resize.startWidth
  let left = resize.startLeft
  if (resize.directionX === 1) {
    width = Math.min(Math.max(minWidth, resize.startWidth + dx), resize.rootWidth - resize.startLeft)
  } else if (resize.directionX === -1) {
    width = Math.min(Math.max(minWidth, resize.startWidth - dx), resize.startLeft + resize.startWidth)
    left = Math.max(0, resize.startLeft + (resize.startWidth - width))
  }

  let height = resize.startHeight
  let top = resize.startTop
  if (resize.directionY === 1) {
    height = Math.min(Math.max(minHeight, resize.startHeight + dy), resize.rootHeight - resize.startTop)
  } else if (resize.directionY === -1) {
    height = Math.min(Math.max(minHeight, resize.startHeight - dy), resize.startTop + resize.startHeight)
    top = Math.max(0, resize.startTop + (resize.startHeight - height))
  }

  return { size: { width, height }, position: { left, top } }
}
