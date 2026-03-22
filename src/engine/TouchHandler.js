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
    this.slidePitchMode = 'continuous'
    this.gravityRadius = 0.5
    this.gravityStrength = 0.5
    this.gravityDecay = 0.5
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
    this.slidePitchMode = settings.slidePitchMode || 'continuous'
    this.gravityRadius = settings.gravityRadius ?? 0.5
    this.gravityStrength = settings.gravityStrength ?? 0.5
    this.gravityDecay = settings.gravityDecay ?? 0.5
    this.pitchBendRange = settings.pitchBendRange || 48
    this.colOffset = settings.colOffset || 1
  }

  tickGravity() {
    if (this.slidePitchMode !== 'assist') return
    const now = performance.now()
    for (const [pointerId, touch] of this.touches) {
      const bendNorm = this._applyPitchMode(touch.lastRawBend, touch, now)
      this.engine.updatePitchBend(pointerId, bendNorm)
      const pitchX = touch.padCenterX + (bendNorm * this.pitchBendRange / this.colOffset) * touch.padSpacing
      this.grid.setTouchActive(touch.row, touch.col, true, bendNorm, null, null, pitchX, null, touch.movementWeight)
    }
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

  _applyPitchMode(rawBend, touch, now) {
    if (this.slidePitchMode === 'continuous') return rawBend
    if (this.slidePitchMode === 'instant') {
      return Math.round(rawBend * this.pitchBendRange) / this.pitchBendRange
    }

    // Movement weight: builds from speed, decays over time
    const dt = Math.min((now - touch.lastBendTime) / 1000, 0.1)
    touch.lastBendTime = now
    const bendDelta = Math.abs(rawBend - touch.lastRawBend)
    touch.movementWeight = Math.min(1, touch.movementWeight + bendDelta * 40)
    touch.movementWeight = Math.max(0, touch.movementWeight - this.gravityDecay * dt * 6)
    touch.lastRawBend = rawBend

    // Gravity well
    const quantized = Math.round(rawBend * this.pitchBendRange) / this.pitchBendRange
    const halfSemitone = 0.5 / this.pitchBendRange
    const radius = this.gravityRadius * halfSemitone
    const dist = Math.abs(rawBend - quantized)

    if (dist >= radius || radius === 0) {
      // Outside radius: drain offset back to zero
      touch.gravityOffset *= Math.max(0, 1 - dt * 10)
    } else {
      // Inside radius: pull toward center over time
      // t controls speed (fast near center, slow at edge)
      // target is always the full distance to center
      const t = 1 - (dist / radius)
      const targetOffset = quantized - rawBend
      const speed = this.gravityStrength * t * (1 - touch.movementWeight) * dt * 40
      touch.gravityOffset += (targetOffset - touch.gravityOffset) * Math.min(speed, 1)
    }

    return rawBend + touch.gravityOffset
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
      currentY: pos.y,
      lastRawBend: 0,
      gravityOffset: 0,
      movementWeight: 0,
      lastBendTime: performance.now()
    })

    this.grid.setTouchActive(hit.row, hit.col, true, 0, timbreNorm, pressure, hit.centerX, pos.y, 0)
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
    const rawBend = Math.max(-1, Math.min(1, semitones / this.pitchBendRange))
    const bendNorm = this._applyPitchMode(rawBend, touch, now)
    this.engine.updatePitchBend(e.pointerId, bendNorm)

    // Timbre: one row up = max, one row down = min
    const timbreNorm = this._calcTimbre(pos.y, touch.padCenterY, touch.rowSpacing)
    this.engine.updateTimbre(e.pointerId, timbreNorm)

    // Pressure
    this.engine.updatePressure(e.pointerId, pressure)

    const pitchX = touch.padCenterX + (bendNorm * this.pitchBendRange / this.colOffset) * touch.padSpacing
    this.grid.setTouchActive(touch.row, touch.col, true, bendNorm, timbreNorm, pressure, pitchX, pos.y, touch.movementWeight)
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
