/**
 * Handles pointer input on the control grid canvas.
 * Translates pixel coordinates to grid cells, manages panning,
 * control value changes, and edit interactions.
 */
export default class ControlGridInput {
  constructor(canvas, callbacks) {
    this.canvas = canvas
    this.cb = callbacks // { onValueChange, onContext, onSelect, onDeselect, onDragResize, onPanChange }
    this.cellSize = 60
    this.gap = 2
    this.panX = 0
    this.panY = 0
    this.locked = false
    this.controls = []
    this.selectedCtrl = null
    this.occupiedSet = new Set()

    this._pointers = new Map() // pointerId → pointer state
    this._onDown = this._onDown.bind(this)
    this._onMove = this._onMove.bind(this)
    this._onUp = this._onUp.bind(this)
    this._onContext = this._onContext.bind(this)

    canvas.addEventListener('pointerdown', this._onDown)
    canvas.addEventListener('pointermove', this._onMove)
    canvas.addEventListener('pointerup', this._onUp)
    canvas.addEventListener('pointercancel', this._onUp)
    canvas.addEventListener('contextmenu', this._onContext)
    canvas.style.touchAction = 'none'
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onDown)
    this.canvas.removeEventListener('pointermove', this._onMove)
    this.canvas.removeEventListener('pointerup', this._onUp)
    this.canvas.removeEventListener('pointercancel', this._onUp)
    this.canvas.removeEventListener('contextmenu', this._onContext)
  }

  get step() { return this.cellSize + this.gap }

  cellFromXY(px, py) {
    const col = Math.floor((px + this.panX) / this.step)
    const row = Math.floor((py + this.panY) / this.step)
    return { col, row }
  }

  hitTestControl(px, py) {
    const worldX = px + this.panX
    const worldY = py + this.panY
    for (const ctrl of this.controls) {
      const x = ctrl.col * this.step
      const y = ctrl.row * this.step
      const w = ctrl.colSpan * this.step - this.gap
      const h = ctrl.rowSpan * this.step - this.gap
      if (worldX >= x && worldX < x + w && worldY >= y && worldY < y + h) {
        return ctrl
      }
    }
    return null
  }

  _canvasXY(e) {
    const rect = this.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  _onContext(e) {
    e.preventDefault()
    if (this.locked) return
    const { x, y } = this._canvasXY(e)
    const cell = this.cellFromXY(x, y)
    const ctrl = this.hitTestControl(x, y)
    if (ctrl) {
      this.cb.onSelect(ctrl.id)
    } else {
      this.cb.onContext(cell, e)
    }
  }

  _onDown(e) {
    e.preventDefault()
    this.canvas.setPointerCapture(e.pointerId)
    const { x, y } = this._canvasXY(e)
    const ctrl = this.hitTestControl(x, y)

    // Selected mode: drag to resize/move
    if (this.selectedCtrl) {
      if (ctrl && ctrl.id !== this.selectedCtrl) {
        this.cb.onSelect(ctrl.id)
        return
      }
      this._pointers.set(e.pointerId, {
        type: 'editDrag',
        startX: e.clientX, startY: e.clientY,
        cell: this.cellFromXY(x, y), dragging: false
      })
      return
    }

    // Play mode
    if (ctrl) {
      const rect = this.canvas.getBoundingClientRect()
      const ctrlX = ctrl.col * this.step - this.panX
      const ctrlY = ctrl.row * this.step - this.panY
      const ctrlW = ctrl.colSpan * this.step - this.gap
      const ctrlH = ctrl.rowSpan * this.step - this.gap

      this._pointers.set(e.pointerId, {
        type: 'control',
        ctrl, startX: e.clientX, startY: e.clientY,
        startVal: this.cb.getValue(ctrl.id),
        ctrlRect: { x: ctrlX + rect.left, y: ctrlY + rect.top, w: ctrlW, h: ctrlH }
      })

      if (ctrl.type === 'button') {
        this.cb.onValueChange(ctrl, 127)
      } else if (ctrl.type === 'toggle') {
        const cur = this.cb.getValue(ctrl.id)
        this.cb.onValueChange(ctrl, cur > 0 ? 0 : 127)
      }
    } else if (!this.locked) {
      this._pointers.set(e.pointerId, {
        type: 'pan',
        startX: e.clientX, startY: e.clientY,
        startPanX: this.panX, startPanY: this.panY
      })
    }
  }

  _onMove(e) {
    const p = this._pointers.get(e.pointerId)
    if (!p) return

    if (p.type === 'pan') {
      this.panX = p.startPanX - (e.clientX - p.startX)
      this.panY = p.startPanY - (e.clientY - p.startY)
      this.cb.onPanChange(this.panX, this.panY)
      return
    }

    if (p.type === 'editDrag') {
      if (!p.dragging) {
        const dx = Math.abs(e.clientX - p.startX)
        const dy = Math.abs(e.clientY - p.startY)
        if (dx > 8 || dy > 8) p.dragging = true
        else return
      }
      const { x, y } = this._canvasXY(e)
      this.cb.onDragResize(p.cell, this.cellFromXY(x, y))
      return
    }

    if (p.type === 'control') {
      const ctrl = p.ctrl
      const r = p.ctrlRect

      if (ctrl.type === 'knob') {
        const dy = p.startY - e.clientY
        const val = Math.max(0, Math.min(127, p.startVal + (dy / 150) * 127))
        this.cb.onValueChange(ctrl, val)
      } else if (ctrl.type === 'fader') {
        if (ctrl.colSpan > ctrl.rowSpan) {
          const val = Math.max(0, Math.min(127, ((e.clientX - r.x) / r.w) * 127))
          this.cb.onValueChange(ctrl, val)
        } else {
          const val = Math.max(0, Math.min(127, (1 - (e.clientY - r.y) / r.h) * 127))
          this.cb.onValueChange(ctrl, val)
        }
      } else if (ctrl.type === 'xypad') {
        const valX = Math.max(0, Math.min(127, ((e.clientX - r.x) / r.w) * 127))
        const valY = Math.max(0, Math.min(127, (1 - (e.clientY - r.y) / r.h) * 127))
        this.cb.onValueChange(ctrl, valX, valY)
      }
    }
  }

  _onUp(e) {
    const p = this._pointers.get(e.pointerId)
    if (!p) return
    this._pointers.delete(e.pointerId)

    if (p.type === 'editDrag') {
      if (p.dragging) {
        const { x, y } = this._canvasXY(e)
        this.cb.onDragResizeEnd(p.cell, this.cellFromXY(x, y))
      } else {
        this.cb.onDeselect()
      }
      return
    }

    if (p.type === 'control' && p.ctrl.type === 'button') {
      this.cb.onValueChange(p.ctrl, 0)
    }
  }
}
