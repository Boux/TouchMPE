import { noteNameShort, isBlackKey } from '../layout/NoteUtils.js'

/**
 * Renders the isomorphic pad grid on a canvas.
 * Maintains pad geometry for hit testing and touch visualization.
 */
export default class GridRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.pads = []   // 2D array [row][col] of pad info
    this.dirty = true
    this.gap = 3
    this.dpr = window.devicePixelRatio || 1

    // Touch state per pad: { active, bendNorm, timbreNorm, pressure }
    this.touchState = []

    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(canvas)
    this._onResize()
  }

  destroy() {
    this._resizeObserver.disconnect()
  }

  /**
   * Set the grid layout data. grid is 2D array from KeyboardLayout.computeGrid().
   */
  setGrid(grid) {
    this.grid = grid
    this.touchState = grid.map(row => row.map(() => ({
      active: false, bendNorm: 0, timbreNorm: 0.5, pressure: 0
    })))
    this._computePadGeometry()
    this.dirty = true
  }

  setTouchActive(row, col, active, bendNorm, timbreNorm, pressure) {
    if (!this.touchState[row] || !this.touchState[row][col]) return
    const s = this.touchState[row][col]
    s.active = active
    s.bendNorm = bendNorm
    s.timbreNorm = timbreNorm
    s.pressure = pressure
    this.dirty = true
  }

  /**
   * Hit test: returns { row, col, note, centerX, centerY, width, height } or null.
   */
  hitTest(x, y) {
    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue
        if (x >= pad.x && x < pad.x + pad.w && y >= pad.y && y < pad.y + pad.h) {
          return {
            row: r,
            col: c,
            note: pad.note,
            centerX: pad.x + pad.w / 2,
            centerY: pad.y + pad.h / 2,
            width: pad.w,
            height: pad.h,
            padCenterX: pad.x + pad.w / 2,
            padCenterY: pad.y + pad.h / 2,
            padWidth: pad.w,
            padHeight: pad.h
          }
        }
      }
    }
    return null
  }

  /**
   * Draw the grid. Call from requestAnimationFrame.
   */
  draw() {
    if (!this.dirty || !this.grid) return
    this.dirty = false

    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    const dpr = this.dpr

    for (let r = 0; r < this.pads.length; r++) {
      for (let c = 0; c < this.pads[r].length; c++) {
        const pad = this.pads[r][c]
        if (!pad) continue

        const cell = this.grid[r][c]
        if (!cell) continue

        const ts = this.touchState[r][c]
        const px = pad.x * dpr
        const py = pad.y * dpr
        const pw = pad.w * dpr
        const ph = pad.h * dpr
        const radius = 4 * dpr

        // Background color
        let bg
        if (ts.active) {
          const alpha = 0.5 + ts.pressure * 0.5
          bg = `rgba(255, 136, 0, ${alpha})`
        } else if (!cell.inScale) {
          bg = '#1e1e1e'
        } else if (isBlackKey(cell.note)) {
          bg = '#2a2a2a'
        } else {
          bg = '#3a3a3a'
        }

        // Draw pad
        ctx.beginPath()
        ctx.roundRect(px, py, pw, ph, radius)
        ctx.fillStyle = bg
        ctx.fill()

        // Note name
        const name = noteNameShort(cell.note)
        const octave = Math.floor(cell.note / 12) - 1
        const fontSize = Math.min(pw, ph) * 0.3
        ctx.fillStyle = ts.active ? '#fff' : (cell.inScale ? '#aaa' : '#555')
        ctx.font = `${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(name, px + pw / 2, py + ph / 2 - fontSize * 0.2)

        // Octave number (smaller, below note name)
        const octFontSize = fontSize * 0.6
        ctx.fillStyle = ts.active ? '#ddd' : '#666'
        ctx.font = `${octFontSize}px sans-serif`
        ctx.fillText(octave, px + pw / 2, py + ph / 2 + fontSize * 0.5)

        // Pitch bend indicator (horizontal bar at bottom)
        if (ts.active && Math.abs(ts.bendNorm) > 0.02) {
          const barY = py + ph - 4 * dpr
          const barH = 3 * dpr
          const barCenter = px + pw / 2
          const barExtent = (pw / 2 - 4 * dpr) * ts.bendNorm
          ctx.fillStyle = 'rgba(255, 200, 50, 0.8)'
          ctx.fillRect(
            Math.min(barCenter, barCenter + barExtent),
            barY,
            Math.abs(barExtent),
            barH
          )
        }
      }
    }
  }

  _onResize() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    this._computePadGeometry()
    this.dirty = true
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
