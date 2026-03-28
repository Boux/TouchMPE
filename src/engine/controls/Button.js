import Control from './Control.js'

export default class Button extends Control {
  constructor(data) {
    super({ ...data, type: data.type || 'button' })
    this._migrateLegacy(data, { cc: 'value' })
    if (this.cc_num.value == null) this.cc_num.value = 64
  }
}
