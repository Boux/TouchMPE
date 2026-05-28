import { createControl, Control } from '../engine/controls/index.js'

let nextId = 1

const DEFAULTS = {
  dockSide: 'right',
  panelSize: 30,
  visible: false,
  cellSize: 60
}

export default class ControlPanelConfig {
  constructor(data = {}) {
    this.dockSide = data.dockSide ?? DEFAULTS.dockSide
    this.panelSize = data.panelSize ?? DEFAULTS.panelSize
    this.cellSize = data.cellSize ?? DEFAULTS.cellSize
    this.visible = data.visible ?? DEFAULTS.visible
    this.controls = (data.controls || []).map(c =>
      c instanceof Control ? c : createControl(c)
    )
    for (const ctrl of this.controls) {
      const num = parseInt(ctrl.id?.replace('ctrl-', ''), 10)
      if (Number.isFinite(num) && num >= nextId) nextId = num + 1
    }
  }

  static generateId() {
    return 'ctrl-' + (nextId++)
  }

  addControl(type, col, row) {
    if (this.isOccupied(col, row)) return null
    const ctrl = createControl({ id: ControlPanelConfig.generateId(), type, col, row })
    const assigned = []
    for (const key of Object.keys(ctrl.cc_num)) {
      ctrl.cc_num[key] = this.nextAvailableCC(ctrl.cc_num[key], ...assigned)
      assigned.push(ctrl.cc_num[key])
    }
    this.controls.push(ctrl)
    return ctrl
  }

  removeControl(id) {
    const i = this.controls.findIndex(c => c.id === id)
    if (i >= 0) this.controls.splice(i, 1)
  }

  changeType(id, newType) {
    const ctrl = this.findControl(id)
    if (!ctrl || ctrl.type === newType) return ctrl
    const oldCC = ctrl.cc_num.value ?? ctrl.cc_num.x ?? 1
    const data = {
      id: ctrl.id,
      type: newType,
      label: ctrl.label,
      col: ctrl.col,
      row: ctrl.row,
      colSpan: ctrl.colSpan,
      rowSpan: ctrl.rowSpan,
      channel: ctrl.channel
    }
    if (newType === 'xypad') {
      data.cc_num = { x: oldCC, y: this.nextAvailableCC(ctrl.cc_num.y ?? 2, oldCC) }
    } else {
      data.cc_num = { value: oldCC }
    }
    const newCtrl = createControl(data)
    const idx = this.controls.findIndex(c => c.id === id)
    this.controls.splice(idx, 1, newCtrl)
    return newCtrl
  }

  resizeControl(id, col, row, colSpan, rowSpan) {
    const ctrl = this.findControl(id)
    if (!ctrl) return false
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        const occupier = this.controlAt(c, r)
        if (occupier && occupier.id !== id) return false
      }
    }
    ctrl.col = col
    ctrl.row = row
    ctrl.colSpan = colSpan
    ctrl.rowSpan = rowSpan
    return true
  }

  findControl(id) {
    return this.controls.find(c => c.id === id) || null
  }

  controlAt(col, row) {
    return this.controls.find(c =>
      col >= c.col && col < c.col + c.colSpan &&
      row >= c.row && row < c.row + c.rowSpan
    ) || null
  }

  isOccupied(col, row) {
    return !!this.controlAt(col, row)
  }

  getOccupiedSet() {
    const s = new Set()
    for (const ctrl of this.controls) {
      for (let r = ctrl.row; r < ctrl.row + ctrl.rowSpan; r++) {
        for (let c = ctrl.col; c < ctrl.col + ctrl.colSpan; c++) {
          s.add(c + ',' + r)
        }
      }
    }
    return s
  }

  nextAvailableCC(preferred, ...exclude) {
    const used = new Set(exclude)
    for (const ctrl of this.controls) {
      for (const v of Object.values(ctrl.cc_num || {})) {
        if (v != null) used.add(v)
      }
    }
    if (!used.has(preferred)) return preferred
    for (let cc = 1; cc <= 127; cc++) {
      if (!used.has(cc)) return cc
    }
    return preferred
  }

  toJSON() {
    return {
      dockSide: this.dockSide,
      panelSize: this.panelSize,
      cellSize: this.cellSize,
      visible: this.visible,
      controls: this.controls.map(c => c.toJSON())
    }
  }
}
