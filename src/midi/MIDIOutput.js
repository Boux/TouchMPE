/**
 * Web MIDI API wrapper.
 * Enumerates available MIDI outputs, lets the user select one, and sends bytes.
 */
export default class MIDIOutput {
  constructor() {
    this.access = null
    this.output = null
    this.outputs = []
    this.onStateChange = null
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser')
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this.access.onstatechange = () => this._refreshOutputs()
    this._refreshOutputs()
  }

  _refreshOutputs() {
    this.outputs = []
    for (const output of this.access.outputs.values()) {
      this.outputs.push({ id: output.id, name: output.name, state: output.state })
    }
    if (this.onStateChange) this.onStateChange(this.outputs)
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
}
