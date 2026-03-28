/**
 * Base class for CC controls.
 * Stores CC numbers and current values as generic key/value maps.
 * Subclasses define which keys they use (e.g. 'value', 'x', 'y').
 */
export default class Control {
  constructor(data) {
    this.id = data.id
    this.type = data.type
    this.label = data.label || ''
    this.col = data.col
    this.row = data.row
    this.colSpan = data.colSpan || 1
    this.rowSpan = data.rowSpan || 1
    this.channel = data.channel ?? 0
    this.cc_num = data.cc_num ? { ...data.cc_num } : {}
    this.values = data.values ? { ...data.values } : {}
  }

  /** Convenience: primary CC number */
  get cc() { return this.cc_num.value }
  set cc(v) { this.cc_num.value = v }

  /** Convenience: primary value */
  get value() { return this.values.value ?? 0 }
  set value(v) { this.values.value = v }

  /** Display label — override in subclasses */
  get displayLabel() { return this.label || ('CC' + (this.cc ?? '?')) }

  /**
   * Returns { ccNumber: value } for all axes with a CC assigned.
   */
  getAllCCValues() {
    const result = {}
    for (const key of Object.keys(this.cc_num)) {
      if (this.cc_num[key] != null) {
        result[this.cc_num[key]] = this.values[key] ?? 0
      }
    }
    return result
  }

  /**
   * Returns { ccNumber: value } for only the specified keys.
   */
  getCCValues(...keys) {
    const result = {}
    for (const key of keys) {
      if (this.cc_num[key] != null) {
        result[this.cc_num[key]] = this.values[key] ?? 0
      }
    }
    return result
  }

  /**
   * Set values. Accepts a number (primary value) or object (named axes).
   * Returns { ccNumber: value } for changed axes — ready to send as MIDI.
   */
  setValues(input) {
    const changes = typeof input === 'number' ? { value: input } : input
    const ccUpdates = {}
    for (const [key, val] of Object.entries(changes)) {
      if (this.values[key] !== val) {
        this.values[key] = val
        if (this.cc_num[key] != null) {
          ccUpdates[this.cc_num[key]] = val
        }
      }
    }
    return ccUpdates
  }

  /**
   * Serialize to plain object for localStorage.
   */
  toJSON() {
    const obj = {
      id: this.id,
      type: this.type,
      label: this.label,
      col: this.col,
      row: this.row,
      colSpan: this.colSpan,
      rowSpan: this.rowSpan,
      cc_num: { ...this.cc_num }
    }
    if (this.channel !== 0) obj.channel = this.channel
    return obj
  }

  /**
   * Migrate legacy flat fields (cc, cc2, x, y) into cc_num.
   * Called by subclass constructors.
   */
  _migrateLegacy(data, mapping) {
    for (const [oldKey, newKey] of Object.entries(mapping)) {
      if (data[oldKey] != null && this.cc_num[newKey] == null) {
        this.cc_num[newKey] = data[oldKey]
      }
    }
  }
}
