import Control from './Control.js'
import Knob from './Knob.js'
import Fader from './Fader.js'
import Button from './Button.js'
import XYPad from './XYPad.js'

const TYPES = {
  knob: Knob,
  fader: Fader,
  button: Button,
  toggle: Button,  // toggle reuses Button (same structure, different behavior)
  xypad: XYPad
}

/**
 * Create a Control instance from plain data (e.g. from localStorage).
 * Handles legacy migration automatically.
 */
export function createControl(data) {
  const Cls = TYPES[data.type] || Control
  return new Cls(data)
}

export { Control, Knob, Fader, Button, XYPad }
