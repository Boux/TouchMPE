import { noteNameShort, isBlackKey } from '../layout/NoteUtils.js'

/**
 * Renders the isomorphic pad grid on a canvas.
 * Uses a two-layer approach:
 *   - Static layer (offscreen canvas): pad backgrounds, note names, octave labels
 *     Redrawn only on resize or grid change.
 *   - Dynamic layer (main canvas): touch feedback (glow, bend/timbre indicators)
 *     Redrawn per frame when touches are active.
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export default class GridRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.pads = []
    this.grid = null
    this.gap = 3
    this.dpr = window.devicePixelRatio || 1
    this.mpeMode = true
    this.accentColor = '#ff8800'
    this.externalNotes = new Set() // notes held from MIDI input

    // Offscreen canvas for static pad layer
    this.staticCanvas = new OffscreenCanvas(1, 1)
    this.staticCtx = this.staticCanvas.getContext('2d')
    this.staticDirty = true

    // Touch state per pad
    this.touchState = []
    this.hasActiveTouches = false
    this.dynamicDirty = true
    this.onResize = null

    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(canvas)
    this._onResize()
  }

  destroy() {
    this._resizeObserver.disconnect()
  }

  setGrid(grid) {
    this.grid = grid
    this.touchState = grid.map(row => row.map(() => ({
      active: false, bendNorm: 0, timbreNorm: 0.5, pressure: 0,
      pointerX: 0, pointerY: 0, movementWeight: 0
    })))
    this._computePadGeometry()
    this.staticDirty = true
    this.dynamicDirty = true
  }

  externalNoteOn(note) {
    this.externalNotes.add(note)
    this.dynamicDirty = true
  }

  externalNoteOff(note) {
    this.externalNotes.delete(note)
    this.dynamicDirty = true
  }

  setTouchActive(row, col, active, bendNorm, timbreNorm, pressure, pointerX = 0, pointerY = 0, movementWeight = null) {
    if (!this.touchState[row] || !this.touchState[row][col]) return
    const s = this.touchState[row][col]
    s.active = active
    if (bendNorm !== null) s.bendNorm = bendNorm
    if (timbreNorm !== null) s.timbreNorm = timbreNorm
    if (pressure !== null) s.pressure = pressure
    if (pointerX !== null) s.pointerX = pointerX
    if (pointerY !== null) s.pointerY = pointerY
    if (movementWeight !== null) s.movementWeight = movementWeight
    this.dynamicDirty = true
    this._updateHasActiveTouches()
  }

  hitTest(x, y) {
    // Hitbox extends to cover the gap between pads so taps in the
    // gap still register. The visual pad stays the same size.
    const halfGap = this.gap / 2
    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue
        if (x >= pad.x - halfGap && x < pad.x + pad.w + halfGap &&
            y >= pad.y - halfGap && y < pad.y + pad.h + halfGap) {
          return {
            row: r, col: c, note: pad.note,
            centerX: pad.x + pad.w / 2,
            centerY: pad.y + pad.h / 2,
            width: pad.w, height: pad.h
          }
        }
      }
    }
    return null
  }

  /**
   * Main draw call — composite static + dynamic layers.
   */
  draw() {
    if (!this.grid) return
    if (!this.staticDirty && !this.dynamicDirty) return

    if (this.staticDirty) {
      this._drawStaticLayer()
      this.staticDirty = false
    }

    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    // Composite: static background
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.staticCanvas, 0, 0)

    // Draw external MIDI input highlights
    if (this.externalNotes.size > 0) {
      this._drawExternalNotes(ctx)
    }

    // Draw dynamic touch overlays on top
    if (this.hasActiveTouches) {
      this._drawTouchOverlays(ctx)
    }

    this.dynamicDirty = false
  }

  // --- Static layer: pads, note names, octave labels ---

  _drawStaticLayer() {
    const ctx = this.staticCtx
    const dpr = this.dpr
    const w = this.canvas.width
    const h = this.canvas.height

    this.staticCanvas.width = w
    this.staticCanvas.height = h
    ctx.clearRect(0, 0, w, h)

    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue
        const cell = this.grid[r][c]
        if (!cell) continue

        const px = pad.x * dpr
        const py = pad.y * dpr
        const pw = pad.w * dpr
        const ph = pad.h * dpr
        // Pad background
        let bg
        if (!cell.inScale) {
          bg = '#1e1e1e'
        } else if (isBlackKey(cell.note)) {
          bg = '#2a2a2a'
        } else {
          bg = '#3a3a3a'
        }

        ctx.beginPath()
        ctx.rect(px, py, pw, ph)
        ctx.fillStyle = bg
        ctx.fill()

        // Subtle border on C notes for octave orientation
        if (cell.note % 12 === 0 && cell.inScale) {
          const { r: ar, g: ag, b: ab } = hexToRgb(this.accentColor)
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.3)`
          ctx.lineWidth = 1.5 * dpr
          ctx.stroke()
        }

        // Note name and octave (only for in-scale notes)
        if (cell.inScale) {
          const name = noteNameShort(cell.note)
          const fontSize = Math.min(pw, ph) * 0.28
          ctx.fillStyle = '#999'
          ctx.font = `600 ${fontSize}px -apple-system, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(name, px + pw / 2, py + ph / 2 - fontSize * 0.15)

          const octave = Math.floor(cell.note / 12) - 1
          const octFontSize = fontSize * 0.55
          ctx.fillStyle = '#555'
          ctx.font = `${octFontSize}px -apple-system, sans-serif`
          ctx.fillText(octave, px + pw / 2, py + ph / 2 + fontSize * 0.55)
        }
      }
    }
  }

  // --- External MIDI input highlights ---

  _drawExternalNotes(ctx) {
    const dpr = this.dpr
    const { r: ar, g: ag, b: ab } = hexToRgb(this.accentColor)

    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue
        if (!this.externalNotes.has(pad.note)) continue

        const px = pad.x * dpr
        const py = pad.y * dpr
        const pw = pad.w * dpr
        const ph = pad.h * dpr

        // Soft glow fill
        ctx.beginPath()
        ctx.rect(px, py, pw, ph)
        ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.2)`
        ctx.fill()

        // Border
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.5)`
        ctx.lineWidth = 1.5 * dpr
        ctx.stroke()
      }
    }
  }

  // --- Dynamic layer: touch feedback overlays ---

  _drawTouchOverlays(ctx) {
    const dpr = this.dpr

    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const ts = this.touchState[r][c]
        if (!ts.active) continue

        const pad = this.pads[r][c]
        if (!pad) continue

        const px = pad.x * dpr
        const py = pad.y * dpr
        const pw = pad.w * dpr
        const ph = pad.h * dpr
        // Pointer position in canvas pixels
        const fingerX = ts.pointerX * dpr
        const fingerY = ts.pointerY * dpr
        const padCenterX = px + pw / 2
        const padCenterY = py + ph / 2

        // Glowing pad fill — brightness scales with velocity
        const { r: ar, g: ag, b: ab } = hexToRgb(this.accentColor)
        const vel = ts.pressure
        const alpha = 0.08 + vel * 0.7
        ctx.beginPath()
        ctx.rect(px, py, pw, ph)
        ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, ${alpha})`
        ctx.fill()

        // Glow border
        const lr = Math.min(255, ar + 40)
        const lg = Math.min(255, ag + 40)
        const lb = Math.min(255, ab + 40)
        ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${0.15 + vel * 0.7})`
        ctx.lineWidth = 1.5 * dpr
        ctx.stroke()

        // Redraw note name in white over the glow
        const cell = this.grid[r][c]
        if (cell) {
          const name = noteNameShort(cell.note)
          const fontSize = Math.min(pw, ph) * 0.28
          ctx.fillStyle = '#fff'
          ctx.font = `600 ${fontSize}px -apple-system, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(name, padCenterX, padCenterY - fontSize * 0.15)

          const octave = Math.floor(cell.note / 12) - 1
          const octFontSize = fontSize * 0.55
          ctx.fillStyle = '#ddd'
          ctx.font = `${octFontSize}px -apple-system, sans-serif`
          ctx.fillText(octave, padCenterX, padCenterY + fontSize * 0.55)
        }

        if (this.mpeMode) {
          // Pitch bend line — horizontal from pad center to finger X
          if (Math.abs(fingerX - padCenterX) > 2 * dpr) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
            ctx.lineWidth = 1.5 * dpr
            ctx.beginPath()
            ctx.moveTo(padCenterX, padCenterY)
            ctx.lineTo(fingerX, padCenterY)
            ctx.stroke()
          }

          // Timbre line — vertical from pad center to finger Y
          if (Math.abs(fingerY - padCenterY) > 2 * dpr) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
            ctx.lineWidth = 1.5 * dpr
            ctx.beginPath()
            ctx.moveTo(padCenterX, padCenterY)
            ctx.lineTo(padCenterX, fingerY)
            ctx.stroke()
          }
        }

      }
    }
  }

  _updateHasActiveTouches() {
    this.hasActiveTouches = false
    for (const row of this.touchState) {
      for (const ts of row) {
        if (ts.active) {
          this.hasActiveTouches = true
          return
        }
      }
    }
  }

  _onResize() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    // Only update pad positions within the current grid —
    // the grid dimensions (cols/rows) are recalculated by Vue on resize
    this._computePadGeometry()
    this.staticDirty = true
    this.dynamicDirty = true

    // Notify listener so Vue can recalculate grid dimensions
    if (this.onResize) this.onResize()
  }

  _computePadGeometry() {
    if (!this.grid || this.grid.length === 0) return

    const rows = this.grid.length
    const cols = this.grid[0].length
    const rect = this.canvas.getBoundingClientRect()
    const gap = this.gap
    const padW = (rect.width - (cols + 1) * gap) / cols
    const padH = (rect.height - (rows + 1) * gap) / rows

    this.pads = []
    for (let r = 0; r < rows; r++) {
      this.pads[r] = []
      for (let c = 0; c < cols; c++) {
        const cell = this.grid[r][c]
        if (!cell) {
          this.pads[r][c] = null
          continue
        }
        this.pads[r][c] = {
          x: gap + c * (padW + gap),
          y: gap + r * (padH + gap),
          w: padW,
          h: padH,
          note: cell.note
        }
      }
    }
  }
}
