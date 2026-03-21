<template>
  <div class="toolbar">
    <span class="toolbar-title">TouchMPE</span>

    <div class="toolbar-inline">
      <button class="toolbar-btn small" @click="$emit('octave-down')">-</button>
      <span class="toolbar-octave">{{ octaveLabel }}</span>
      <button class="toolbar-btn small" @click="$emit('octave-up')">+</button>
    </div>

    <div class="toolbar-spacer"></div>

    <span
      class="midi-status"
      :class="{ connected: midiOutputName }"
    ></span>

    <button class="toolbar-btn" @click="menuOpen = !menuOpen">
      Menu
    </button>

    <button
      class="toolbar-btn"
      :class="{ active: settingsOpen }"
      @click="$emit('toggle-settings')"
    >
      Settings
    </button>

    <div v-if="menuOpen" class="toolbar-menu" @click.self="menuOpen = false">
      <div class="toolbar-menu-panel">
        <label class="menu-label">
          MIDI Output
          <select
            :value="selectedOutputId"
            @change="$emit('select-output', $event.target.value); menuOpen = false"
          >
            <option value="" disabled>Select...</option>
            <option
              v-for="output in midiOutputs"
              :key="output.id"
              :value="output.id"
            >
              {{ output.name }}
            </option>
          </select>
        </label>

        <label class="menu-label">
          Layout
          <select
            :value="settings.preset"
            @change="$emit('preset-change', $event.target.value); menuOpen = false"
          >
            <option value="chromatic">Chromatic</option>
            <option value="guitar">Guitar</option>
            <option value="thirds">Thirds</option>
            <option value="fifths">Fifths</option>
            <option value="wickiHayden">Wicki-Hayden</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <button class="menu-btn panic" @click="$emit('panic'); menuOpen = false">
          Panic (All Notes Off)
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Toolbar',

  props: {
    settings: { type: Object, required: true },
    midiOutputName: { type: String, default: null },
    midiOutputs: { type: Array, default: () => [] },
    settingsOpen: { type: Boolean, default: false }
  },

  emits: ['select-output', 'toggle-settings', 'octave-up', 'octave-down', 'preset-change', 'panic'],

  data() {
    return {
      menuOpen: false
    }
  },

  computed: {
    selectedOutputId() {
      const match = this.midiOutputs.find(o => o.name === this.midiOutputName)
      return match ? match.id : ''
    },

    octaveLabel() {
      const note = this.settings.rootNote
      const octave = Math.floor(note / 12) - 1
      return 'C' + octave
    }
  }
}
</script>

<style lang="sass">
.toolbar
  display: flex
  align-items: center
  height: 36px
  padding: 0 8px
  background: #222
  border-bottom: 1px solid #333
  flex-shrink: 0
  gap: 6px
  position: relative

.toolbar-title
  font-size: 13px
  font-weight: 600
  color: #ff8800

.toolbar-inline
  display: flex
  align-items: center
  gap: 3px

.toolbar-octave
  font-size: 12px
  color: #ccc
  min-width: 24px
  text-align: center

.toolbar-spacer
  flex: 1

.midi-status
  width: 8px
  height: 8px
  border-radius: 50%
  background: #555
  flex-shrink: 0

  &.connected
    background: #4c4
    box-shadow: 0 0 4px #4c4

.toolbar-btn
  background: #333
  color: #ccc
  border: 1px solid #444
  border-radius: 3px
  padding: 4px 10px
  font-size: 12px
  cursor: pointer
  white-space: nowrap
  flex-shrink: 0

  &:hover
    background: #444

  &.active
    background: #ff8800
    color: #000
    border-color: #ff8800

  &.small
    padding: 3px 6px
    font-size: 11px
    min-width: 24px

.toolbar-menu
  position: fixed
  inset: 0
  top: 36px
  background: rgba(0, 0, 0, 0.4)
  z-index: 90

.toolbar-menu-panel
  background: #2a2a2a
  border: 1px solid #444
  border-top: none
  padding: 12px
  display: flex
  flex-direction: column
  gap: 10px
  max-width: 300px
  margin-left: auto

.menu-label
  display: flex
  justify-content: space-between
  align-items: center
  font-size: 13px
  color: #aaa

  select
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 3px
    padding: 4px 8px
    font-size: 13px
    max-width: 160px

.menu-btn
  background: #333
  color: #ccc
  border: 1px solid #444
  border-radius: 3px
  padding: 6px 12px
  font-size: 13px
  cursor: pointer
  text-align: left

  &:hover
    background: #444

  &.panic
    color: #f66
    border-color: #633

    &:hover
      background: #622
</style>
