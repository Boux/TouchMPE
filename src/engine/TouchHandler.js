/**
 * Handles Pointer Events on the canvas and translates them into
 * MPE engine calls (noteOn, noteOff, pitch bend, timbre, pressure).
 */
export default class TouchHandler {
  constructor(canvas, engine, gridRenderer) {
    this.canvas = canvas
    this.engine = engine
    this.grid = gridRenderer
    // pointerId → touch state
    this.touches = new Map()

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

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  _getPressure(e) {
    // Pointer Events pressure: 0.0–1.0, 0.5 when active without pressure support
    if (e.pressure !== undefined && e.pressure !== 0.5) {
      return e.pressure
    }
    // Fallback: use contact area as pressure proxy
    if (e.width && e.height) {
      const area = e.width * e.height
      // Normalize: typical finger ~40-400 sq px
      return Math.min(1, Math.max(0, (area - 40) / 360))
    }
    return 0.5
  }

  _onPointerDown(e) {
    e.preventDefault()
    const pos = this._getCanvasPos(e)
    const hit = this.grid.hitTest(pos.x, pos.y)
    if (!hit) return

    const pressure = this._getPressure(e)
    const timbreNorm = this._calcTimbre(pos.y, hit)

    const channel = this.engine.noteOn(e.pointerId, hit.note, pressure, timbreNorm)

    this.touches.set(e.pointerId, {
      channel,
      note: hit.note,
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

    // Pitch bend: X displacement from pad center, normalized to -1..+1
    const xOffset = pos.x - touch.padCenterX
    const bendNorm = xOffset / (touch.padWidth / 2)
    this.engine.updatePitchBend(e.pointerId, bendNorm)

    // Timbre: Y position within pad, normalized to 0..1 (top=1, bottom=0)
    const timbreNorm = this._calcTimbre(pos.y, touch)
    this.engine.updateTimbre(e.pointerId, timbreNorm)

    // Pressure
    const pressure = this._getPressure(e)
    this.engine.updatePressure(e.pointerId, pressure)

    // Update visual state
    const hit = this.grid.hitTest(touch.padCenterX, touch.padCenterY)
    if (hit) {
      this.grid.setTouchActive(hit.row, hit.col, true, bendNorm, timbreNorm, pressure)
    }
  }

  _onPointerUp(e) {
    const touch = this.touches.get(e.pointerId)
    if (!touch) return

    e.preventDefault()
    this.engine.noteOff(e.pointerId)
    this.touches.delete(e.pointerId)

    // Clear visual state
    const hit = this.grid.hitTest(touch.padCenterX, touch.padCenterY)
    if (hit) {
      this.grid.setTouchActive(hit.row, hit.col, false, 0, 0.5, 0)
    }
  }

  _calcTimbre(y, padInfo) {
    const yOffset = padInfo.padCenterY - y
    return Math.max(0, Math.min(1, 0.5 + yOffset / padInfo.padHeight))
  }
}
