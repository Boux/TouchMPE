<template>
  <section>
    <Field label="Mode">
      <select :value="settings.mpeMode ? 'mpe' : 'midi'"
        @change="$emit('toggle-mpe', $event.target.value === 'mpe')">
        <option value="mpe">MPE</option>
        <option value="midi">MIDI</option>
      </select>
    </Field>

    <Field label="MIDI Output">
      <select :value="selectedOutputId" @change="$emit('select-output', $event.target.value)">
        <option value="" disabled>Select...</option>
        <option v-for="output in midiOutputs" :key="output.id" :value="output.id">
          {{ output.name }}
        </option>
      </select>
    </Field>

    <Field label="MIDI Input">
      <select :value="selectedInputId" @change="$emit('select-input', $event.target.value)">
        <option value="">None</option>
        <option v-for="input in midiInputs" :key="input.id" :value="input.id">
          {{ input.name }}
        </option>
      </select>
    </Field>

    <template v-if="settings.mpeMode !== false">
      <Field label="Pitch Bend Range">
        <div class="compound-input">
          <input type="number" :value="settings.pitchBendRange" min="1" max="96"
            @change="update('pitchBendRange', +$event.target.value)" />
          <span class="unit">st</span>
        </div>
      </Field>

      <Field label="Member Channels">
        <input type="number" :value="settings.memberChannels" min="1" max="15"
          @change="update('memberChannels', +$event.target.value)" />
      </Field>
    </template>

    <button class="btn btn-danger btn-block" @click="$emit('panic')">Panic (All Notes Off)</button>
  </section>
</template>

<script>
import Field from '../common/Field.vue'

export default {
  name: 'MidiTab',
  components: { Field },

  props: {
    settings: { type: Object, required: true },
    midiOutputs: { type: Array, default: () => [] },
    midiInputs: { type: Array, default: () => [] },
    midiOutputName: { type: String, default: null },
    midiInputName: { type: String, default: null }
  },

  emits: ['update', 'select-output', 'select-input', 'toggle-mpe', 'panic'],

  computed: {
    selectedOutputId() {
      const match = this.midiOutputs.find(o => o.name === this.midiOutputName)
      return match ? match.id : ''
    },
    selectedInputId() {
      return this.midiInputName
        ? (this.midiInputs.find(i => i.name === this.midiInputName)?.id || '')
        : ''
    }
  },

  methods: {
    update(key, value) {
      this.$emit('update', { ...this.settings, [key]: value, preset: 'custom' })
    }
  }
}
</script>
