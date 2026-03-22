const BG = '#1a1a1a'
const CELL_BG = '#222'
const CTRL_BG = '#2a2a2a'
const CTRL_BORDER = '#3a3a3a'
const ORANGE = '#ff8800'
const TEXT_DIM = '#666'
const TEXT_MED = '#888'

export default class ControlGridRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = window.devicePixelRatio || 1
    this.dirty = true

    this._resizeObs = new ResizeObserver(() => this._resize())
    this._resizeObs.observe(canvas)
    this._resize()
  }

  destroy() {
    this._resizeObs.disconnect()
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    this.dirty = true
  }

  draw(state) {
    if (!this.dirty) return
    this.dirty = false

    const { cellSize, gap, panX, panY, controls, controlValues, xyValues,
            selectedCtrl, dragStart, dragEnd, occupiedSet } = state
    const ctx = this.ctx
    const dpr = this.dpr
    const step = cellSize + gap

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    // Visible cell range
    const startCol = Math.floor(panX / step)
    const startRow = Math.floor(panY / step)
    const endCol = Math.ceil((panX + this.width) / step)
    const endRow = Math.ceil((panY + this.height) / step)

    // Draw empty cells
    ctx.fillStyle = CELL_BG
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (occupiedSet.has(col + ',' + row)) continue
        const x = col * step - panX
        const y = row * step - panY
        this._roundRect(ctx, x, y, cellSize, cellSize, 3)
        ctx.fill()
      }
    }

    // Draw drag highlight
    if (selectedCtrl && dragStart && dragEnd) {
      const c1 = Math.min(dragStart.col, dragEnd.col)
      const c2 = Math.max(dragStart.col, dragEnd.col)
      const r1 = Math.min(dragStart.row, dragEnd.row)
      const r2 = Math.max(dragStart.row, dragEnd.row)
      ctx.fillStyle = 'rgba(255, 136, 0, 0.25)'
      ctx.strokeStyle = ORANGE
      ctx.lineWidth = 1.5
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const x = c * step - panX
          const y = r * step - panY
          this._roundRect(ctx, x, y, cellSize, cellSize, 3)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Draw controls
    for (const ctrl of controls) {
      const x = ctrl.col * step - panX
      const y = ctrl.row * step - panY
      const w = ctrl.colSpan * step - gap
      const h = ctrl.rowSpan * step - gap
      const val = controlValues[ctrl.id] ?? 0
      const isSelected = selectedCtrl === ctrl.id

      // Background
      ctx.fillStyle = CTRL_BG
      ctx.strokeStyle = isSelected ? ORANGE : CTRL_BORDER
      ctx.lineWidth = isSelected ? 2 : 1
      this._roundRect(ctx, x, y, w, h, 6)
      ctx.fill()
      ctx.stroke()

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 8
        this._roundRect(ctx, x, y, w, h, 6)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Type-specific rendering
      const cx = x + w / 2
      const cy = y + h / 2
      const minDim = Math.min(w, h)

      switch (ctrl.type) {
        case 'knob':
          this._drawKnob(ctx, cx, cy, minDim * 0.32, val)
          break
        case 'fader':
          this._drawFader(ctx, x, y, w, h, val, ctrl.colSpan > ctrl.rowSpan)
          break
        case 'xypad':
          this._drawXYPad(ctx, x, y, w, h, val, xyValues[ctrl.id] ?? 64)
          break
        case 'button':
        case 'toggle':
          this._drawButton(ctx, cx, cy, minDim * 0.25, val > 0)
          break
      }

      // Label
      const label = ctrl.label || ('CC' + (ctrl.cc ?? 1))
      ctx.fillStyle = TEXT_MED
      ctx.font = `${Math.min(11, minDim * 0.18)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, cx, y + 3, w - 4)

      // Value
      ctx.fillStyle = TEXT_DIM
      ctx.font = `${Math.min(11, minDim * 0.16)}px -apple-system, sans-serif`
      ctx.textBaseline = 'bottom'
      ctx.fillText(Math.round(val).toString(), cx, y + h - 2, w - 4)
    }
  }

  _drawKnob(ctx, cx, cy, radius, val) {
    const startAngle = 0.75 * Math.PI
    const endAngle = 2.25 * Math.PI
    const valAngle = startAngle + (val / 127) * (endAngle - startAngle)

    // Track
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = Math.max(3, radius * 0.16)
    ctx.lineCap = 'round'
    ctx.stroke()

    // Value arc
    if (val > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, valAngle)
      ctx.strokeStyle = ORANGE
      ctx.stroke()
    }

    // Dot at value position
    const dotX = cx + Math.cos(valAngle) * radius
    const dotY = cy + Math.sin(valAngle) * radius
    ctx.beginPath()
    ctx.arc(dotX, dotY, Math.max(2, radius * 0.1), 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()

    ctx.lineCap = 'butt'
  }

  _drawFader(ctx, x, y, w, h, val, horizontal) {
    const pad = 0.1
    const trackW = horizontal ? w * 0.8 : w * 0.3
    const trackH = horizontal ? h * 0.3 : h * 0.8
    const tx = x + (w - trackW) / 2
    const ty = y + (h - trackH) / 2

    // Track background
    ctx.fillStyle = '#333'
    this._roundRect(ctx, tx, ty, trackW, trackH, 3)
    ctx.fill()

    // Fill
    ctx.fillStyle = ORANGE
    if (horizontal) {
      const fillW = (val / 127) * trackW
      this._roundRect(ctx, tx, ty, fillW, trackH, 3)
    } else {
      const fillH = (val / 127) * trackH
      this._roundRect(ctx, tx, ty + trackH - fillH, trackW, fillH, 3)
    }
    ctx.fill()
  }

  _drawXYPad(ctx, x, y, w, h, valX, valY) {
    const pad = Math.min(w, h) * 0.075
    const ax = x + pad
    const ay = y + pad + 12
    const aw = w - pad * 2
    const ah = h - pad * 2 - 14

    // Background
    ctx.fillStyle = '#333'
    this._roundRect(ctx, ax, ay, aw, ah, 4)
    ctx.fill()

    // Dot
    const dotX = ax + (valX / 127) * aw
    const dotY = ay + (1 - valY / 127) * ah
    ctx.beginPath()
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()
  }

  _drawButton(ctx, cx, cy, radius, on) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = on ? ORANGE : '#444'
    ctx.fill()

    if (on) {
      ctx.shadowColor = ORANGE
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }
}
