import Control from './Control.js'

export default class Knob extends Control {
  constructor(data) {
    super({ ...data, type: 'knob' })
    this._migrateLegacy(data, { cc: 'value' })
    if (this.cc_num.value == null) this.cc_num.value = 1
  }
}
