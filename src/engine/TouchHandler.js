/**
 * Handles Pointer Events on the canvas and translates them into
 * MPE engine calls (noteOn, noteOff, pitch bend, timbre, pressure).
 */
export default class TouchHandler {
  constructor(canvas, engine, gridRenderer) {
    this.canvas = canvas
    this.engine = engine
    this.grid = gridRenderer
    this.touches = new Map()

    // Touch settings
    this.pressureMode = 'auto' // 'auto', 'force', 'area', 'fixed'
    this.slidePitchQuantize = false
    this.pitchBendRange = 48

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
        // Use force if available, fall back to area
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

  _quantizeBend(bendNorm) {
    if (!this.slidePitchQuantize) return bendNorm
    // Snap to nearest semitone boundary
    const semitones = Math.round(bendNorm * this.pitchBendRange)
    return semitones / this.pitchBendRange
  }

  _onPointerDown(e) {
    e.preventDefault()
    const pos = this._getCanvasPos(e)
    const hit = this.grid.hitTest(pos.x, pos.y)
    if (!hit) return

    const pressure = this._getPressure(e)
    const timbreNorm = this._calcTimbre(pos.y, hit.centerY, hit.height)

    const channel = this.engine.noteOn(e.pointerId, hit.note, pressure, timbreNorm)

    this.touches.set(e.pointerId, {
      channel,
      note: hit.note,
      row: hit.row,
      col: hit.col,
      padCenterX: hit.centerX,
      padCenterY: hit.centerY,
      padWidth: hit.width,
      padHeight: hit.height,
      currentX: pos.x,
      currentY: pos.y
    })

    this.grid.setTouchActive(hit.row, hit.col, true, 0, timbreNorm, pressure)
  }

  _onPointerMove(e) {
    const touch = this.touches.get(e.pointerId)
    if (!touch) return

    e.preventDefault()
    const pos = this._getCanvasPos(e)
    touch.currentX = pos.x
    touch.currentY = pos.y

    // Pitch bend
    const xOffset = pos.x - touch.padCenterX
    let bendNorm = Math.max(-1, Math.min(1, xOffset / (touch.padWidth / 2)))
    bendNorm = this._quantizeBend(bendNorm)
    this.engine.updatePitchBend(e.pointerId, bendNorm)

    // Timbre
    const timbreNorm = this._calcTimbre(pos.y, touch.padCenterY, touch.padHeight)
    this.engine.updateTimbre(e.pointerId, timbreNorm)

    // Pressure
    const pressure = this._getPressure(e)
    this.engine.updatePressure(e.pointerId, pressure)

    this.grid.setTouchActive(touch.row, touch.col, true, bendNorm, timbreNorm, pressure)
  }

  _onPointerUp(e) {
    const touch = this.touches.get(e.pointerId)
    if (!touch) return

    e.preventDefault()
    this.engine.noteOff(e.pointerId)
    this.touches.delete(e.pointerId)

    this.grid.setTouchActive(touch.row, touch.col, false, 0, 0.5, 0)
  }

  _calcTimbre(y, padCenterY, padHeight) {
    const yOffset = padCenterY - y
    return Math.max(0, Math.min(1, 0.5 + yOffset / padHeight))
  }
}
