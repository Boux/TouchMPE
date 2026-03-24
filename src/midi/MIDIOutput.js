/**
 * Web MIDI API wrapper.
 * Enumerates available MIDI outputs, lets the user select one, and sends bytes.
 */
export default class MIDIOutput {
  constructor() {
    this.access = null
    this.output = null
    this.outputs = []
    this.input = null
    this.inputs = []
    this.onStateChange = null
    this.onNoteOn = null   // (note, velocity, channel) => {}
    this.onNoteOff = null  // (note, channel) => {}
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser')
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this._refreshTimer = null
    this.access.onstatechange = () => {
      clearTimeout(this._refreshTimer)
      this._refreshTimer = setTimeout(() => this._refreshPorts(), 100)
    }
    this._refreshPorts()
  }

  _refreshPorts() {
    this.outputs = []
    for (const output of this.access.outputs.values()) {
      this.outputs.push({ id: output.id, name: output.name, state: output.state })
    }
    this.inputs = []
    for (const input of this.access.inputs.values()) {
      this.inputs.push({ id: input.id, name: input.name, state: input.state })
    }
    if (this.onStateChange) this.onStateChange(this.outputs, this.inputs)
  }

  getOutputs() {
    return this.outputs
  }

  selectOutput(id) {
    this.output = this.access.outputs.get(id) || null
  }

  send(bytes) {
    if (this.output) {
      this.output.send(bytes)
    }
  }

  get selectedId() {
    return this.output ? this.output.id : null
  }

  get selectedName() {
    return this.output ? this.output.name : null
  }

  getInputs() {
    return this.inputs
  }

  selectInput(id) {
    // Disconnect previous input
    if (this.input) {
      this.input.onmidimessage = null
    }
    this.input = (id && this.access) ? (this.access.inputs.get(id) || null) : null
    if (this.input) {
      this.input.onmidimessage = (e) => this._onMIDIMessage(e)
    }
  }

  _onMIDIMessage(e) {
    const data = e.data
    if (data.length < 2) return
    const status = data[0] & 0xF0
    const channel = data[0] & 0x0F

    if (status === 0x90 && data.length >= 3 && data[2] > 0) {
      if (this.onNoteOn) this.onNoteOn(data[1], data[2], channel)
    } else if (status === 0x80 || (status === 0x90 && data[2] === 0)) {
      if (this.onNoteOff) this.onNoteOff(data[1], channel)
    }
  }

  get selectedInputId() {
    return this.input ? this.input.id : null
  }

  get selectedInputName() {
    return this.input ? this.input.name : null
  }
}
