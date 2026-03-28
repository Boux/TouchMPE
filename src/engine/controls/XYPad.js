import Control from './Control.js'

export default class XYPad extends Control {
  constructor(data) {
    super({ ...data, type: 'xypad' })
    // Migrate legacy: cc → x, cc2 → y
    this._migrateLegacy(data, { cc: 'x', x: 'x', cc2: 'y', y: 'y' })
    if (this.cc_num.x == null) this.cc_num.x = 1
    if (this.cc_num.y == null) this.cc_num.y = 2
  }

  get displayLabel() { return this.label || ('CC' + this.cc_x) }

  get cc_x() { return this.cc_num.x }
  set cc_x(v) { this.cc_num.x = v }

  get cc_y() { return this.cc_num.y }
  set cc_y(v) { this.cc_num.y = v }

  get x() { return this.values.x ?? 0 }
  set x(v) { this.values.x = v }

  get y() { return this.values.y ?? 0 }
  set y(v) { this.values.y = v }
}
