const BG = '#1a1a1a'
const CELL_BG = '#222'
const CTRL_BG = '#2a2a2a'
const CTRL_BORDER = '#3a3a3a'
const ORANGE = '#ff8800'
const TEXT_DIM = '#666'
const TEXT_MED = '#999'

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

    // Fill empty cells
    ctx.fillStyle = CELL_BG
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (occupiedSet.has(col + ',' + row)) continue
        const x = col * step - panX
        const y = row * step - panY
        ctx.fillRect(x, y, cellSize, cellSize)
      }
    }

    // Grid lines disabled for testing

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
          ctx.fillRect(x, y, cellSize, cellSize)
          ctx.strokeRect(x, y, cellSize, cellSize)
        }
      }
    }

    // Draw controls — flush with each other, dark border between
    for (const ctrl of controls) {
      const x = ctrl.col * step - panX
      const y = ctrl.row * step - panY
      const w = ctrl.colSpan * step
      const h = ctrl.rowSpan * step
      const val = controlValues[ctrl.id] ?? 0
      const isSelected = selectedCtrl === ctrl.id

      // Background (fills full cell including gap area)
      ctx.fillStyle = CTRL_BG
      ctx.fillRect(x, y, w, h)

      // Embossed look: light top/left edges, dark bottom/right edges
      if (!isSelected) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 0.5, y + h)
        ctx.lineTo(x + 0.5, y + 0.5)
        ctx.lineTo(x + w, y + 0.5)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.beginPath()
        ctx.moveTo(x + w - 0.5, y)
        ctx.lineTo(x + w - 0.5, y + h - 0.5)
        ctx.lineTo(x, y + h - 0.5)
        ctx.stroke()
      }

      // Selection border + glow
      if (isSelected) {
        ctx.strokeStyle = ORANGE
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, h)
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 8
        ctx.strokeRect(x, y, w, h)
        ctx.shadowBlur = 0
      }

      // Type-specific rendering
      const cx = x + w / 2
      const cy = y + h / 2
      const minDim = Math.min(w, h)

      switch (ctrl.type) {
        case 'knob':
          this._drawKnob(ctx, cx, cy, minDim * 0.24, val)
          break
        case 'fader':
          this._drawFader(ctx, x, y, w, h, val, ctrl.colSpan > ctrl.rowSpan)
          break
        case 'xypad':
          this._drawXYPad(ctx, x, y, w, h, val, xyValues[ctrl.id] ?? 64)
          break
        case 'button':
        case 'toggle':
          this._drawButton(ctx, x, y, w, h, val > 0)
          break
      }

      // Label
      const label = ctrl.label || ('CC' + (ctrl.cc ?? 1))
      ctx.fillStyle = TEXT_MED
      ctx.font = `600 ${Math.min(11, minDim * 0.18)}px -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, cx, y + 6, w - 12)

      // Value (skip for buttons/toggles)
      if (ctrl.type !== 'button' && ctrl.type !== 'toggle') {
        ctx.fillStyle = TEXT_DIM
        ctx.font = `600 ${Math.min(11, minDim * 0.16)}px -apple-system, sans-serif`
        ctx.textBaseline = 'bottom'
        if (ctrl.type === 'xypad') {
          const valY = xyValues[ctrl.id] ?? 64
          ctx.fillText(`${Math.round(val)}, ${Math.round(valY)}`, cx, y + h - 5, w - 12)
        } else {
          ctx.fillText(Math.round(val).toString(), cx, y + h - 5, w - 12)
        }
      }
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
    ctx.lineWidth = Math.max(4, radius * 0.25)
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
    const trackW = horizontal ? w * 0.85 : w * 0.45
    const trackH = horizontal ? h * 0.45 : h * 0.8
    const tx = x + (w - trackW) / 2
    const ty = y + (h - trackH) / 2

    // Track background with border
    ctx.fillStyle = '#333'
    ctx.fillRect(tx, ty, trackW, trackH)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(tx, ty, trackW, trackH)

    // Fill
    ctx.fillStyle = ORANGE
    if (horizontal) {
      const fillW = (val / 127) * trackW
      ctx.fillRect(tx, ty, fillW, trackH)
    } else {
      const fillH = (val / 127) * trackH
      ctx.fillRect(tx, ty + trackH - fillH, trackW, fillH)
    }
  }

  _drawXYPad(ctx, x, y, w, h, valX, valY) {
    const pad = Math.min(w, h) * 0.075
    const ax = x + pad
    const ay = y + pad + 14
    const aw = w - pad * 2
    const ah = h - pad * 2 - 18

    // Background with border
    ctx.fillStyle = '#333'
    ctx.fillRect(ax, ay, aw, ah)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.strokeRect(ax, ay, aw, ah)

    // Dotted grid lines
    ctx.setLineDash([1, 4])
    ctx.strokeStyle = '#4a4a4a'
    ctx.lineWidth = 1
    // Vertical lines (quarters)
    for (let i = 1; i < 4; i++) {
      const gx = Math.round(ax + (aw * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(gx, ay)
      ctx.lineTo(gx, ay + ah)
      ctx.stroke()
    }
    // Horizontal lines (quarters)
    for (let i = 1; i < 4; i++) {
      const gy = Math.round(ay + (ah * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(ax, gy)
      ctx.lineTo(ax + aw, gy)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Dot
    const dotX = ax + (valX / 127) * aw
    const dotY = ay + (1 - valY / 127) * ah
    ctx.beginPath()
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()
  }

  _drawButton(ctx, x, y, w, h, on) {
    const mx = 10
    const bx = x + mx
    const by = y + mx + 12
    const bw = w - mx * 2
    const bh = h - mx * 2 - 16
    const travel = 3
    const faceY = on ? by + travel : by

    // Pit — only visible at the bottom beneath the face
    ctx.fillStyle = '#181818'
    ctx.fillRect(bx, by + bh, bw, travel)

    // Button face — subtle gradient
    const faceGrad = ctx.createLinearGradient(bx, faceY, bx, faceY + bh)
    faceGrad.addColorStop(0, on ? '#3a3a3a' : '#4a4a4a')
    faceGrad.addColorStop(1, on ? '#303030' : '#3c3c3c')
    ctx.fillStyle = faceGrad
    ctx.fillRect(bx, faceY, bw, bh)

    // Bevel — top/left highlight
    ctx.strokeStyle = on ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx + 0.5, faceY + bh)
    ctx.lineTo(bx + 0.5, faceY + 0.5)
    ctx.lineTo(bx + bw, faceY + 0.5)
    ctx.stroke()

    // Bevel — bottom/right shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.moveTo(bx + bw - 0.5, faceY)
    ctx.lineTo(bx + bw - 0.5, faceY + bh - 0.5)
    ctx.lineTo(bx, faceY + bh - 0.5)
    ctx.stroke()

    // LED strip — small bar near the top of the button face
    const ledH = Math.max(3, Math.min(5, bh * 0.08))
    const ledMx = 6
    const ledX = bx + ledMx
    const ledY = faceY + 6
    const ledW = bw - ledMx * 2

    // LED recess
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(ledX - 1, ledY - 1, ledW + 2, ledH + 2)

    // LED
    ctx.fillStyle = on ? ORANGE : '#2a2a2a'
    ctx.fillRect(ledX, ledY, ledW, ledH)

    if (on) {
      ctx.shadowColor = ORANGE
      ctx.shadowBlur = 6
      ctx.fillRect(ledX, ledY, ledW, ledH)
      ctx.shadowBlur = 0
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }
}
