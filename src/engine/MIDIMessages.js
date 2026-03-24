/**
 * MIDI message byte construction helpers.
 * All methods return arrays of bytes.
 */

export function noteOn(channel, note, velocity) {
  return [0x90 | channel, note, velocity]
}

export function noteOff(channel, note, velocity = 0) {
  return [0x80 | channel, note, velocity]
}

export function pitchBend(channel, value) {
  // value: 0–16383 (14-bit), 8192 = center/no bend
  const clamped = Math.max(0, Math.min(16383, value))
  return [0xE0 | channel, clamped & 0x7F, (clamped >> 7) & 0x7F]
}

export function controlChange(channel, controller, value) {
  return [0xB0 | channel, controller, Math.max(0, Math.min(127, value))]
}

export function channelPressure(channel, pressure) {
  return [0xD0 | channel, Math.max(0, Math.min(127, pressure))]
}

/**
 * Send RPN (Registered Parameter Number) message.
 */
export function rpn(channel, rpnMsb, rpnLsb, dataMsb, dataLsb = 0) {
  return [
    ...controlChange(channel, 101, rpnMsb),
    ...controlChange(channel, 100, rpnLsb),
    ...controlChange(channel, 6, dataMsb),
    ...controlChange(channel, 38, dataLsb)
  ]
}

/**
 * MPE Configuration Message — declare Lower Zone with N member channels.
 */
export function mpeConfig(memberChannelCount) {
  return rpn(0, 0, 6, memberChannelCount)
}

/**
 * Set pitch bend sensitivity on a channel (in semitones).
 */
export function pitchBendSensitivity(channel, semitones) {
  return rpn(channel, 0, 0, semitones)
}

/**
 * All Notes Off on a channel.
 */
export function allNotesOff(channel) {
  return controlChange(channel, 123, 0)
}

/**
 * All Sound Off on a channel — immediately kills all sound
 * regardless of sustain pedal or other controllers.
 */
export function allSoundOff(channel) {
  return controlChange(channel, 120, 0)
}

/**
 * Reset All Controllers on a channel — clears sustain, expression,
 * modulation, and all other controllers to their default values.
 */
export function resetAllControllers(channel) {
  return controlChange(channel, 121, 0)
}
