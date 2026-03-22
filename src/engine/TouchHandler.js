import { TouchFilter } from './JitterFilter.js'

/**
 * Handles Pointer Events on the canvas and translates them into
 * MPE engine calls (noteOn, noteOff, pitch bend, timbre, pressure).
 *
 * Pitch bend spans the full grid: sliding from one pad center to the
 * next = colOffset semitones of bend. No per-pad clamping.
 *
 * Timbre spans two rows: pad center = 0.5, one row up = 1.0, one row down = 0.0.
 */
export default class TouchHandler {
  constructor(canvas, engine, gridRenderer) {
    this.canvas = canvas
    this.engine = engine
    this.grid = gridRenderer
    this.touches = new Map()
    this.filters = new Map()

    // Touch settings
    this.pressureMode = 'auto'
    this.slidePitchQuantize = false
    this.pitchBendRange = 48
    this.colOffset = 1
    this.deadZonePx = 5 // pixels of movement before bend starts

    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)

    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', this._onPointerDown)
    canvas.addEventListener('pointermove', this._onPointerMove)
    canvas.addEventListener('pointerup', this._onPointerUp)
    canvas.addEventListener('pointercancel', this._onPointerUp)
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    this.canvas.removeEventListener('pointermove', this._onPointerMove)
    this.canvas.removeEventListener('pointerup', this._onPointerUp)
    this.canvas.removeEventListener('pointercancel', this._onPointerUp)
  }

  applySettings(settings) {
    this.pressureMode = settings.pressureMode || 'auto'
    this.slidePitchQuantize = settings.slidePitchQuantize || false
    this.pitchBendRange = settings.pitchBendRange || 48
    this.colOffset = settings.colOffset || 1
  }

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  _getPressure(e) {
    switch (this.pressureMode) {
      case 'force':
        return e.pressure || 0
      case 'area':
        return this._areaToNorm(e)
      case 'fixed':
        return 0.7
      case 'auto':
      default:
        if (e.pressure !== undefined && e.pressure !== 0.5 && e.pressure !== 0) {
          return e.pressure
        }
        if (e.width && e.height) {
          return this._areaToNorm(e)
        }
        return 0.5
    }
  }

  _areaToNorm(e) {
    if (!e.width || !e.height) return 0.5
    const area = e.width * e.height
    return Math.min(1, Math.max(0, (area - 40) / 360))
  }

  _applyDeadZonePx(xOffset) {
    if (Math.abs(xOffset) < this.deadZonePx) return 0
    const sign = Math.sign(xOffset)
    return sign * (Math.abs(xOffset) - this.deadZonePx)
  }

  _quantizeBend(bendNorm) {
    if (!this.slidePitchQuantize) return bendNorm
    const semitones = Math.round(bendNorm * this.pitchBendRange)
    return semitones / this.pitchBendRange
  }

  _onPointerDown(e) {
    e.preventDefault()
    const pos = this._getCanvasPos(e)
    const hit = this.grid.hitTest(pos.x, pos.y)
    if (!hit) return

    const filter = new TouchFilter()
    this.filters.set(e.pointerId, filter)

    const pressure = this._getPressure(e)
    // Pad spacing = distance between adjacent pad centers
    const padSpacing = hit.width + this.grid.gap
    const rowSpacing = hit.height + this.grid.gap
    const timbreNorm = this._calcTimbre(pos.y, hit.centerY, rowSpacing)

    const channel = this.engine.noteOn(e.pointerId, hit.note, pressure, timbreNorm)

    this.touches.set(e.pointerId, {
      channel,
      note: hit.note,
      row: hit.row,
      col: hit.col,
      padCenterX: hit.centerX,
      padCenterY: hit.centerY,
      padSpacing,
      rowSpacing,
      currentX: pos.x,
      currentY: pos.y
    })

    this.grid.setTouchActive(hit.row, hit.col, true, 0, timbreNorm, pressure, pos.x, pos.y)
  }

  _onPointerMove(e) {
    const touch = this.touches.get(e.pointerId)
    if (!touch) return

    e.preventDefault()
    const rawPos = this._getCanvasPos(e)
    const now = e.timeStamp || performance.now()

    const filter = this.filters.get(e.pointerId)
    const pos = filter ? filter.filterPos(rawPos.x, rawPos.y, now) : rawPos
    const rawPressure = this._getPressure(e)
    const pressure = filter ? filter.filterPressure(rawPressure, now) : rawPressure

    touch.currentX = pos.x
    touch.currentY = pos.y

    // Pitch bend: slide across the grid
    const rawXOffset = pos.x - touch.padCenterX
    const xOffset = this._applyDeadZonePx(rawXOffset)
    const semitones = (xOffset / touch.padSpacing) * this.colOffset
    let bendNorm = Math.max(-1, Math.min(1, semitones / this.pitchBendRange))
    bendNorm = this._quantizeBend(bendNorm)
    this.engine.updatePitchBend(e.pointerId, bendNorm)

    // Timbre: one row up = max, one row down = min
    const timbreNorm = this._calcTimbre(pos.y, touch.padCenterY, touch.rowSpacing)
    this.engine.updateTimbre(e.pointerId, timbreNorm)

    // Pressure
    this.engine.updatePressure(e.pointerId, pressure)

    this.grid.setTouchActive(touch.row, touch.col, true, bendNorm, timbreNorm, pressure, pos.x, pos.y)
  }

  _onPointerUp(e) {
    const touch = this.touches.get(e.pointerId)
    if (!touch) return

    e.preventDefault()
    this.engine.noteOff(e.pointerId)
    this.touches.delete(e.pointerId)
    this.filters.delete(e.pointerId)

    this.grid.setTouchActive(touch.row, touch.col, false, 0, 0.5, 0, 0, 0)
  }

  /**
   * Timbre: center of pad = 0.5, one row up = 1.0, one row down = 0.0
   * rowSpacing = distance between row centers (padHeight + gap)
   */
  _calcTimbre(y, padCenterY, rowSpacing) {
    const yOffset = padCenterY - y
    return Math.max(0, Math.min(1, 0.5 + yOffset / (2 * rowSpacing)))
  }
}
