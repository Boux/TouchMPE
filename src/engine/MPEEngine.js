import ChannelAllocator from './ChannelAllocator.js'
import * as msg from './MIDIMessages.js'

/**
 * Core MPE engine. Translates touch events into MPE MIDI messages.
 * Manages channel allocation, per-note expression, and message batching.
 */
export default class MPEEngine {
  constructor(midiOutput) {
    this.midiOutput = midiOutput
    this.allocator = new ChannelAllocator(15)
    this.pitchBendRange = 48 // semitones
    this.pendingBytes = []
  }

  /**
   * Apply settings from the settings store.
   */
  applySettings(settings) {
    const memberCountChanged = settings.memberChannels !== this.allocator.memberCount
    const pbRangeChanged = settings.pitchBendRange !== this.pitchBendRange

    if (memberCountChanged) {
      this.panic()
      this.allocator.setMemberCount(settings.memberChannels)
    }

    this.pitchBendRange = settings.pitchBendRange

    if ((memberCountChanged || pbRangeChanged) && this.midiOutput.output) {
      this.sendConfig()
    }
  }

  /**
   * Send MPE configuration to the output (zone config + pitch bend sensitivity).
   */
  sendConfig() {
    // Send each CC message individually so the USB MIDI transport
    // and DAW can parse the RPN sequence correctly.
    this._sendRPN(msg.mpeConfig(this.allocator.memberCount))
    this._sendRPN(msg.pitchBendSensitivity(0, 2)) // master: ±2 semitones
    for (let ch = 1; ch <= this.allocator.memberCount; ch++) {
      this._sendRPN(msg.pitchBendSensitivity(ch, this.pitchBendRange))
    }
  }

  /**
   * Send an RPN message as individual 3-byte CC messages.
   */
  _sendRPN(bytes) {
    for (let i = 0; i < bytes.length; i += 3) {
      this.midiOutput.send(bytes.slice(i, i + 3))
    }
  }

  /**
   * Called on pointerdown. Allocates channel and sends Note On.
   * Returns the allocated channel, or null if no note.
   */
  noteOn(pointerId, note, velocity, initialTimbreNorm = 0.5) {
    const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)))
    const { channel, stolen } = this.allocator.allocate(pointerId, note)

    // If voice stealing, send Note Off for the stolen note
    if (stolen) {
      this.pendingBytes.push(...msg.noteOff(channel, stolen.note))
    }

    // Send initial state before Note On: pitch bend center, CC74 timbre
    const timbreValue = Math.round(Math.max(0, Math.min(1, initialTimbreNorm)) * 127)
    this.pendingBytes.push(
      ...msg.pitchBend(channel, 8192),
      ...msg.controlChange(channel, 74, timbreValue),
      ...msg.noteOn(channel, note, vel)
    )

    return channel
  }

  /**
   * Called on pointerup. Sends Note Off and releases channel.
   */
  noteOff(pointerId) {
    const channel = this.allocator.channelForPointer(pointerId)
    if (channel === null) return

    const info = this.allocator.active.get(channel)
    if (info) {
      this.pendingBytes.push(...msg.noteOff(channel, info.note))
    }
    this.allocator.release(channel)
  }

  /**
   * Update pitch bend for an active touch.
   * bendNorm: -1.0 to +1.0 (normalized displacement from pad center)
   */
  updatePitchBend(pointerId, bendNorm) {
    const channel = this.allocator.channelForPointer(pointerId)
    if (channel === null) return

    const clamped = Math.max(-1, Math.min(1, bendNorm))
    const value = Math.round(8192 + clamped * 8191)
    this.pendingBytes.push(...msg.pitchBend(channel, value))
  }

  /**
   * Update timbre (CC74) for an active touch.
   * timbreNorm: 0.0 to 1.0
   */
  updateTimbre(pointerId, timbreNorm) {
    const channel = this.allocator.channelForPointer(pointerId)
    if (channel === null) return

    const value = Math.round(Math.max(0, Math.min(1, timbreNorm)) * 127)
    this.pendingBytes.push(...msg.controlChange(channel, 74, value))
  }

  /**
   * Update channel pressure for an active touch.
   * pressureNorm: 0.0 to 1.0
   */
  updatePressure(pointerId, pressureNorm) {
    const channel = this.allocator.channelForPointer(pointerId)
    if (channel === null) return

    const value = Math.round(Math.max(0, Math.min(1, pressureNorm)) * 127)
    this.pendingBytes.push(...msg.channelPressure(channel, value))
  }

  /**
   * Send a CC message on the manager channel (channel 0).
   * value: 0–127
   */
  sendCC(ccNumber, value) {
    const clamped = Math.round(Math.max(0, Math.min(127, value)))
    this.pendingBytes.push(...msg.controlChange(0, ccNumber, clamped))
  }

  /**
   * Flush all pending MIDI messages to the output. Call once per frame.
   */
  flush() {
    if (this.pendingBytes.length === 0) return
    // Parse and send each MIDI message individually.
    // Status byte high nibble determines message length.
    let i = 0
    while (i < this.pendingBytes.length) {
      const status = this.pendingBytes[i] & 0xF0
      // Channel Pressure and Program Change are 2 bytes, everything else is 3
      const len = (status === 0xC0 || status === 0xD0) ? 2 : 3
      this.midiOutput.send(this.pendingBytes.slice(i, i + len))
      i += len
    }
    this.pendingBytes = []
  }

  /**
   * Send All Notes Off on all channels. Call on page unload or panic.
   */
  panic() {
    for (let ch = 0; ch <= 15; ch++) {
      this.midiOutput.send(msg.allNotesOff(ch))
      this.midiOutput.send(msg.pitchBend(ch, 8192))
    }
    this.allocator.setMemberCount(this.allocator.memberCount)
  }
}
