import { noteNameShort, isBlackKey } from '../layout/NoteUtils.js'

/**
 * Renders the isomorphic pad grid on a canvas.
 * Uses a two-layer approach:
 *   - Static layer (offscreen canvas): pad backgrounds, note names, octave labels
 *     Redrawn only on resize or grid change.
 *   - Dynamic layer (main canvas): touch feedback (glow, bend/timbre indicators)
 *     Redrawn per frame when touches are active.
 */
export default class GridRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.pads = []
    this.grid = null
    this.gap = 3
    this.dpr = window.devicePixelRatio || 1

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
      active: false, bendNorm: 0, timbreNorm: 0.5, pressure: 0
    })))
    this._computePadGeometry()
    this.staticDirty = true
    this.dynamicDirty = true
  }

  setTouchActive(row, col, active, bendNorm, timbreNorm, pressure) {
    if (!this.touchState[row] || !this.touchState[row][col]) return
    const s = this.touchState[row][col]
    s.active = active
    s.bendNorm = bendNorm
    s.timbreNorm = timbreNorm
    s.pressure = pressure
    this.dynamicDirty = true
    this._updateHasActiveTouches()
  }

  hitTest(x, y) {
    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue
        if (x >= pad.x && x < pad.x + pad.w && y >= pad.y && y < pad.y + pad.h) {
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
        const radius = 4 * dpr

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
        ctx.roundRect(px, py, pw, ph, radius)
        ctx.fillStyle = bg
        ctx.fill()

        // Subtle border on C notes for octave orientation
        if (cell.note % 12 === 0 && cell.inScale) {
          ctx.strokeStyle = 'rgba(255, 136, 0, 0.3)'
          ctx.lineWidth = 1.5 * dpr
          ctx.stroke()
        }

        // Note name
        const name = noteNameShort(cell.note)
        const fontSize = Math.min(pw, ph) * 0.28
        ctx.fillStyle = cell.inScale ? '#999' : '#444'
        ctx.font = `600 ${fontSize}px -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(name, px + pw / 2, py + ph / 2 - fontSize * 0.15)

        // Octave number (smaller, below)
        const octave = Math.floor(cell.note / 12) - 1
        const octFontSize = fontSize * 0.55
        ctx.fillStyle = cell.inScale ? '#555' : '#333'
        ctx.font = `${octFontSize}px -apple-system, sans-serif`
        ctx.fillText(octave, px + pw / 2, py + ph / 2 + fontSize * 0.55)
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
        const radius = 4 * dpr

        // Glowing pad fill
        const alpha = 0.4 + ts.pressure * 0.5
        ctx.beginPath()
        ctx.roundRect(px, py, pw, ph, radius)
        ctx.fillStyle = `rgba(255, 136, 0, ${alpha})`
        ctx.fill()

        // Glow border
        ctx.strokeStyle = `rgba(255, 170, 50, ${0.6 + ts.pressure * 0.4})`
        ctx.lineWidth = 2 * dpr
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
          ctx.fillText(name, px + pw / 2, py + ph / 2 - fontSize * 0.15)

          const octave = Math.floor(cell.note / 12) - 1
          const octFontSize = fontSize * 0.55
          ctx.fillStyle = '#ddd'
          ctx.font = `${octFontSize}px -apple-system, sans-serif`
          ctx.fillText(octave, px + pw / 2, py + ph / 2 + fontSize * 0.55)
        }

        // Pitch bend indicator (horizontal bar at bottom of pad)
        if (Math.abs(ts.bendNorm) > 0.02) {
          const barY = py + ph - 5 * dpr
          const barH = 3 * dpr
          const barCenter = px + pw / 2
          const maxExtent = pw / 2 - 6 * dpr
          const barExtent = maxExtent * ts.bendNorm

          ctx.fillStyle = 'rgba(255, 220, 80, 0.9)'
          ctx.fillRect(
            Math.min(barCenter, barCenter + barExtent),
            barY,
            Math.abs(barExtent),
            barH
          )
          // Center tick mark
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.fillRect(barCenter - 0.5 * dpr, barY, 1 * dpr, barH)
        }

        // Timbre indicator (vertical bar on right side of pad)
        const timbreHeight = (ph - 12 * dpr) * ts.timbreNorm
        if (Math.abs(ts.timbreNorm - 0.5) > 0.02) {
          const barX = px + pw - 5 * dpr
          const barW = 3 * dpr
          const barBottom = py + ph - 6 * dpr
          ctx.fillStyle = 'rgba(80, 200, 255, 0.8)'
          ctx.fillRect(barX, barBottom - timbreHeight, barW, timbreHeight)
          // Center tick
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.fillRect(barX, barBottom - (ph - 12 * dpr) * 0.5 - 0.5 * dpr, barW, 1 * dpr)
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
