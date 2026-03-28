import Control from './Control.js'

export default class Fader extends Control {
  constructor(data) {
    super({ ...data, type: 'fader' })
    this._migrateLegacy(data, { cc: 'value' })
    if (this.cc_num.value == null) this.cc_num.value = 7
  }
}
