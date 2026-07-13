import {
  computeDefaultFullSize,
  computeDragPosition,
  computeResize,
  RESIZE_HANDLE_DIRECTIONS,
  type DragState,
  type ResizeState
} from './panelGeometry'

describe('computeDefaultFullSize', () => {
  const options = { margin: 12, minWidth: 400, minHeight: 390 }

  it('fills the root minus the margin on each side when large enough', () => {
    const result = computeDefaultFullSize({ width: 1000, height: 800 }, options)
    expect(result).toEqual({
      position: { left: 12, top: 12 },
      size: { width: 976, height: 776 }
    })
  })

  it('clamps to the minimum size when the root is smaller than the minimum + margins', () => {
    const result = computeDefaultFullSize({ width: 100, height: 100 }, options)
    expect(result.size).toEqual({ width: 400, height: 390 })
    expect(result.position).toEqual({ left: 12, top: 12 })
  })
})

describe('computeDragPosition', () => {
  const drag: DragState = {
    pointerId: 1,
    startClientX: 100,
    startClientY: 100,
    startLeft: 50,
    startTop: 50,
    maxLeft: 200,
    maxTop: 150
  }

  it('moves the panel by the pointer delta', () => {
    expect(computeDragPosition(drag, 130, 120)).toEqual({ left: 80, top: 70 })
  })

  it('clamps to 0 when dragged past the top-left edge', () => {
    expect(computeDragPosition(drag, -1000, -1000)).toEqual({ left: 0, top: 0 })
  })

  it('clamps to maxLeft/maxTop when dragged past the bottom-right edge', () => {
    expect(computeDragPosition(drag, 5000, 5000)).toEqual({ left: 200, top: 150 })
  })
})

describe('computeResize', () => {
  const baseResize: ResizeState = {
    pointerId: 1,
    startClientX: 500,
    startClientY: 500,
    startLeft: 100,
    startTop: 100,
    startWidth: 400,
    startHeight: 390,
    directionX: 0,
    directionY: 0,
    rootWidth: 1000,
    rootHeight: 800
  }
  const minOptions = { minWidth: 400, minHeight: 390 }

  it('east (right edge): grows width, leaves left/top unchanged', () => {
    const resize: ResizeState = { ...baseResize, directionX: 1 }
    const { size, position } = computeResize(resize, 600, 500, minOptions)
    expect(size).toEqual({ width: 500, height: 390 })
    expect(position).toEqual({ left: 100, top: 100 })
  })

  it('east: clamps growth to the root width', () => {
    const resize: ResizeState = { ...baseResize, directionX: 1 }
    const { size } = computeResize(resize, 5000, 500, minOptions)
    expect(size.width).toBe(1000 - 100)
  })

  it('west (left edge): grows width and moves left, shrinking to the min clamps left back', () => {
    const resize: ResizeState = { ...baseResize, directionX: -1 }
    const { size, position } = computeResize(resize, 400, 500, minOptions)
    expect(size.width).toBe(500)
    expect(position.left).toBe(0)
  })

  it('west: shrinking below minWidth clamps width to minWidth', () => {
    const resize: ResizeState = { ...baseResize, directionX: -1 }
    const { size, position } = computeResize(resize, 5000, 500, minOptions)
    expect(size.width).toBe(400)
    expect(position.left).toBe(100)
  })

  it('south (bottom edge): grows height, leaves top unchanged', () => {
    const resize: ResizeState = { ...baseResize, directionY: 1 }
    const { size, position } = computeResize(resize, 500, 600, minOptions)
    expect(size).toEqual({ width: 400, height: 490 })
    expect(position).toEqual({ left: 100, top: 100 })
  })

  it('north (top edge): grows height and moves top', () => {
    const resize: ResizeState = { ...baseResize, directionY: -1 }
    const { size, position } = computeResize(resize, 500, 400, minOptions)
    expect(size.height).toBe(490)
    expect(position.top).toBe(0)
  })

  it('corner (southeast): resizes both axes independently', () => {
    const resize: ResizeState = { ...baseResize, directionX: 1, directionY: 1 }
    const { size } = computeResize(resize, 600, 600, minOptions)
    expect(size).toEqual({ width: 500, height: 490 })
  })

  it('no direction (0,0): returns the starting size/position unchanged', () => {
    const { size, position } = computeResize(baseResize, 900, 900, minOptions)
    expect(size).toEqual({ width: 400, height: 390 })
    expect(position).toEqual({ left: 100, top: 100 })
  })
})

describe('RESIZE_HANDLE_DIRECTIONS', () => {
  it('has exactly the 4 edges and 4 corners, each with a distinct css suffix', () => {
    expect(RESIZE_HANDLE_DIRECTIONS).toHaveLength(8)
    const suffixes = RESIZE_HANDLE_DIRECTIONS.map((h) => h.cssSuffix)
    expect(new Set(suffixes).size).toBe(8)
  })
})
