<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-title">TouchMPE</span>
    </div>
    <div class="toolbar-center">
      <label class="toolbar-label">
        MIDI Output
        <select
          class="toolbar-select"
          :value="selectedOutputId"
          @change="$emit('select-output', $event.target.value)"
        >
          <option value="" disabled>Select output...</option>
          <option
            v-for="output in midiOutputs"
            :key="output.id"
            :value="output.id"
          >
            {{ output.name }}
          </option>
        </select>
      </label>
      <span
        class="midi-status"
        :class="{ connected: midiOutputName }"
      ></span>
    </div>
    <div class="toolbar-right">
      <button
        class="toolbar-btn"
        :class="{ active: settingsOpen }"
        @click="$emit('toggle-settings')"
      >
        Settings
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Toolbar',

  props: {
    midiOutputName: { type: String, default: null },
    midiOutputs: { type: Array, default: () => [] },
    settingsOpen: { type: Boolean, default: false }
  },

  emits: ['select-output', 'toggle-settings'],

  computed: {
    selectedOutputId() {
      const match = this.midiOutputs.find(o => o.name === this.midiOutputName)
      return match ? match.id : ''
    }
  }
}
</script>

<style lang="sass">
.toolbar
  display: flex
  align-items: center
  justify-content: space-between
  height: 40px
  padding: 0 12px
  background: #222
  border-bottom: 1px solid #333
  flex-shrink: 0

.toolbar-left
  display: flex
  align-items: center

.toolbar-title
  font-size: 14px
  font-weight: 600
  color: #ff8800

.toolbar-center
  display: flex
  align-items: center
  gap: 8px

.toolbar-label
  font-size: 12px
  color: #888
  display: flex
  align-items: center
  gap: 6px

.toolbar-select
  background: #333
  color: #ccc
  border: 1px solid #444
  border-radius: 3px
  padding: 2px 6px
  font-size: 12px

.midi-status
  width: 8px
  height: 8px
  border-radius: 50%
  background: #555

  &.connected
    background: #4c4
    box-shadow: 0 0 4px #4c4

.toolbar-right
  display: flex
  align-items: center

.toolbar-btn
  background: #333
  color: #ccc
  border: 1px solid #444
  border-radius: 3px
  padding: 4px 12px
  font-size: 12px
  cursor: pointer

  &:hover
    background: #444

  &.active
    background: #ff8800
    color: #000
    border-color: #ff8800
</style>
