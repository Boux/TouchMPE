<template>
  <div class="toolbar-menu" @click.self="$emit('close')">
    <div class="toolbar-menu-panel">
      <label class="menu-label">
        MIDI Output
        <select
          :value="selectedOutputId"
          @change="$emit('select-output', $event.target.value); $emit('close')"
        >
          <option value="" disabled>Select...</option>
          <option v-for="output in midiOutputs" :key="output.id" :value="output.id">
            {{ output.name }}
          </option>
        </select>
      </label>

      <label class="menu-label">
        MIDI Input
        <select
          :value="selectedInputId"
          @change="$emit('select-input', $event.target.value); $emit('close')"
        >
          <option value="">None</option>
          <option v-for="input in midiInputs" :key="input.id" :value="input.id">
            {{ input.name }}
          </option>
        </select>
      </label>

      <label class="menu-label">
        Mode
        <select
          :value="settings.mpeMode ? 'mpe' : 'midi'"
          @change="$emit('toggle-mpe', $event.target.value === 'mpe')"
        >
          <option value="mpe">MPE</option>
          <option value="midi">MIDI</option>
        </select>
      </label>

      <button class="btn btn-danger btn-block" @click="$emit('panic'); $emit('close')">
        Panic (All Notes Off)
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ToolbarMenu',

  props: {
    settings: { type: Object, required: true },
    midiOutputs: { type: Array, default: () => [] },
    midiInputs: { type: Array, default: () => [] },
    midiOutputName: { type: String, default: null },
    midiInputName: { type: String, default: null }
  },

  emits: ['select-output', 'select-input', 'toggle-mpe', 'panic', 'close'],

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
  }
}
</script>

<style lang="sass">
.toolbar-menu
  position: fixed
  inset: 0
  top: 36px
  background: rgba(0, 0, 0, 0.4)
  z-index: var(--z-overlay)

.toolbar-menu-panel
  background: var(--color-surface-2)
  border: var(--border-hairline) solid var(--color-border-strong)
  border-top: none
  padding: var(--space-4)
  display: flex
  flex-direction: column
  gap: var(--space-3)
  max-width: 320px
  margin-left: auto

.menu-label
  display: flex
  justify-content: space-between
  align-items: center
  font-size: var(--text-md)
  color: var(--color-text-secondary)

  select
    max-width: 180px
</style>
