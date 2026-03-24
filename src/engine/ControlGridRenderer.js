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
          this._drawXYPad(ctx, x, y, w, h, val, xyValues[ctrl.id] ?? 64, ctrl)
          break
        case 'button':
        case 'toggle':
          this._drawButton(ctx, x, y, w, h, val > 0)
          break
      }

      // Label and value — XY pads draw these inside the pad area
      if (ctrl.type !== 'xypad') {
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
          ctx.fillText(Math.round(val).toString(), cx, y + h - 5, w - 12)
        }
      }
    }
  }

  _drawKnob(ctx, cx, cy, radius, val) {
    const startAngle = 0.75 * Math.PI
    const endAngle = 2.25 * Math.PI
    const valAngle = startAngle + (val / 127) * (endAngle - startAngle)

    // Flat dark recess
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#222'
    ctx.fill()
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Value arc — glowing orange sweep
    if (val > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, valAngle)
      ctx.strokeStyle = ORANGE
      ctx.lineWidth = 3
      ctx.lineCap = 'butt'
      ctx.shadowColor = ORANGE
      ctx.shadowBlur = 5
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Dead arc — dim track for the remaining range
    ctx.beginPath()
    ctx.arc(cx, cy, radius, valAngle, endAngle)
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 3
    ctx.stroke()

    // Knob cap — flat circle, slightly smaller
    const capR = radius * 0.55
    ctx.beginPath()
    ctx.arc(cx, cy, capR, 0, Math.PI * 2)
    ctx.fillStyle = '#3a3a3a'
    ctx.fill()
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Pointer notch — a small line from center outward
    const notchInner = capR * 0.2
    const notchOuter = capR * 0.9
    ctx.shadowColor = ORANGE
    ctx.shadowBlur = 3
    ctx.strokeStyle = ORANGE
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(valAngle) * notchInner, cy + Math.sin(valAngle) * notchInner)
    ctx.lineTo(cx + Math.cos(valAngle) * notchOuter, cy + Math.sin(valAngle) * notchOuter)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.lineCap = 'butt'
  }

  _drawFader(ctx, x, y, w, h, val, horizontal) {
    const trackW = horizontal ? w * 0.85 : 8
    const trackH = horizontal ? 8 : h * 0.75
    const tx = x + (w - trackW) / 2
    const ty = y + (h - trackH) / 2

    // Recessed channel
    ctx.fillStyle = '#181818'
    ctx.fillRect(tx - 1, ty - 1, trackW + 2, trackH + 2)
    ctx.fillStyle = '#222'
    ctx.fillRect(tx, ty, trackW, trackH)

    // Orange fill strip (thin, centered, with glow)
    if (val > 0) {
      const stripW = horizontal ? 0 : 2
      const stripH = horizontal ? 2 : 0
      const sx = horizontal ? tx : tx + trackW / 2 - stripW / 2
      const sy = horizontal ? ty + trackH / 2 - stripH / 2 : ty

      if (horizontal) {
        const fillW = (val / 127) * trackW
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 6
        ctx.fillStyle = ORANGE
        ctx.fillRect(sx, sy, fillW, stripH || 2)
        ctx.shadowBlur = 0
      } else {
        const fillH = (val / 127) * trackH
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 6
        ctx.fillStyle = ORANGE
        ctx.fillRect(sx, sy + trackH - fillH, stripW || 2, fillH)
        ctx.shadowBlur = 0
      }
    }

    // Thumb/handle
    const thumbSize = horizontal ? 6 : trackW + 10
    const thumbThick = horizontal ? trackH + 10 : 6

    let thumbX, thumbY
    if (horizontal) {
      thumbX = tx + (val / 127) * trackW - thumbSize / 2
      thumbY = ty + trackH / 2 - thumbThick / 2
    } else {
      thumbX = tx + trackW / 2 - thumbSize / 2
      thumbY = ty + trackH * (1 - val / 127) - thumbThick / 2
    }

    // Thumb shadow
    ctx.fillStyle = '#181818'
    ctx.fillRect(thumbX, thumbY + 2, thumbSize, thumbThick)

    // Thumb body
    const thumbGrad = horizontal
      ? ctx.createLinearGradient(thumbX, thumbY, thumbX, thumbY + thumbThick)
      : ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbSize, thumbY)
    thumbGrad.addColorStop(0, '#5a5a5a')
    thumbGrad.addColorStop(0.5, '#4a4a4a')
    thumbGrad.addColorStop(1, '#3a3a3a')
    ctx.fillStyle = thumbGrad
    ctx.fillRect(thumbX, thumbY, thumbSize, thumbThick)

    // Thumb grip line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    if (horizontal) {
      const mx = thumbX + thumbSize / 2 + 0.5
      ctx.beginPath()
      ctx.moveTo(mx, thumbY + 3)
      ctx.lineTo(mx, thumbY + thumbThick - 3)
      ctx.stroke()
    } else {
      const my = thumbY + thumbThick / 2 + 0.5
      ctx.beginPath()
      ctx.moveTo(thumbX + 3, my)
      ctx.lineTo(thumbX + thumbSize - 3, my)
      ctx.stroke()
    }

    // Thumb bevel
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.moveTo(thumbX + 0.5, thumbY + thumbThick)
    ctx.lineTo(thumbX + 0.5, thumbY + 0.5)
    ctx.lineTo(thumbX + thumbSize, thumbY + 0.5)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.moveTo(thumbX + thumbSize - 0.5, thumbY)
    ctx.lineTo(thumbX + thumbSize - 0.5, thumbY + thumbThick - 0.5)
    ctx.lineTo(thumbX, thumbY + thumbThick - 0.5)
    ctx.stroke()
  }

  _drawXYPad(ctx, x, y, w, h, valX, valY, ctrl) {
    const showFaders = (ctrl ? ctrl.colSpan : 1) >= 2 && (ctrl ? ctrl.rowSpan : 1) >= 2
    const strip = 10
    const pad = showFaders ? 12 : 6
    const topPad = showFaders ? 16 : 6
    const bottomPad = showFaders ? 16 : 6
    const faderGap = 6

    let ax, ay, aw, ah

    if (showFaders) {
      // Side fader areas
      const fx = x + pad
      const fy = y + topPad
      const fh = h - topPad - bottomPad
      const bfx = x + pad + strip + faderGap
      const bfy = y + h - bottomPad - strip
      const bfw = w - pad * 2 - strip - faderGap

      ax = bfx
      ay = fy
      aw = bfw
      ah = fh - strip - faderGap

      // --- Y-axis fader (left) ---
      ctx.fillStyle = '#222'
      ctx.fillRect(fx, fy, strip, ah)
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      ctx.strokeRect(fx, fy, strip, ah)
      if (valY > 0) {
        const yFillH = (valY / 127) * ah
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 5
        ctx.fillStyle = ORANGE
        ctx.fillRect(fx + strip / 2 - 1, fy + ah - yFillH, 2, yFillH)
        ctx.shadowBlur = 0
      }

      // --- X-axis fader (bottom) ---
      ctx.fillStyle = '#222'
      ctx.fillRect(bfx, bfy, bfw, strip)
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 1
      ctx.strokeRect(bfx, bfy, bfw, strip)
      if (valX > 0) {
        const xFillW = (valX / 127) * bfw
        ctx.shadowColor = ORANGE
        ctx.shadowBlur = 5
        ctx.fillStyle = ORANGE
        ctx.fillRect(bfx, bfy + strip / 2 - 1, xFillW, 2)
        ctx.shadowBlur = 0
      }
    } else {
      ax = x + pad
      ay = y + topPad
      aw = w - pad * 2
      ah = h - topPad - bottomPad
    }

    // --- Main pad (recessed) ---
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(ax - 1, ay - 1, aw + 2, ah + 2)
    ctx.fillStyle = '#282828'
    ctx.fillRect(ax, ay, aw, ah)

    // Dotted grid lines
    ctx.setLineDash([1, 3])
    ctx.strokeStyle = '#0a0a0a'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const gx = Math.round(ax + (aw * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(gx, ay)
      ctx.lineTo(gx, ay + ah)
      ctx.stroke()
    }
    for (let i = 1; i < 4; i++) {
      const gy = Math.round(ay + (ah * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(ax, gy)
      ctx.lineTo(ax + aw, gy)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Crosshair lines from dot to edges
    const dotX = ax + (valX / 127) * aw
    const dotY = ay + (1 - valY / 127) * ah
    ctx.strokeStyle = 'rgba(255, 136, 0, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(dotX, ay)
    ctx.lineTo(dotX, ay + ah)
    ctx.moveTo(ax, dotY)
    ctx.lineTo(ax + aw, dotY)
    ctx.stroke()

    // Dot
    ctx.beginPath()
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2)
    ctx.fillStyle = ORANGE
    ctx.fill()

    // Label inside pad (top-left)
    const label = ctrl ? (ctrl.label || ('CC' + (ctrl.cc ?? 1))) : ''
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `600 ${Math.min(10, aw * 0.08)}px -apple-system, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, ax + 4, ay + 3, aw - 8)

    // Coordinates (bottom-right)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${Math.round(valX)}, ${Math.round(valY)}`, ax + aw - 4, ay + ah - 3, aw - 8)
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
