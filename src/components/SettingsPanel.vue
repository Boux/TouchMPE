<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal settings-modal">
      <header class="settings-header">
        <h2>Settings</h2>
        <IconButton name="close" :size="20" @click="$emit('close')" />
      </header>

      <nav class="settings-tabs">
        <button v-for="tab in tabs" :key="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </nav>

      <div class="settings-body">
        <LayoutTab v-if="activeTab === 'layout'"
          :settings="settings"
          @update="$emit('update', $event)" />

        <TouchTab v-else-if="activeTab === 'touch'"
          :settings="settings"
          @update="$emit('update', $event)"
          @start-calibration="calibrating = true" />

        <MidiTab v-else-if="activeTab === 'mpe'"
          :settings="settings"
          :midi-outputs="midiOutputs"
          :midi-inputs="midiInputs"
          :midi-output-name="midiOutputName"
          :midi-input-name="midiInputName"
          @update="$emit('update', $event)"
          @select-output="$emit('select-output', $event)"
          @select-input="$emit('select-input', $event)"
          @toggle-mpe="$emit('toggle-mpe', $event)"
          @panic="$emit('panic')" />
      </div>

      <footer class="settings-build">build 11</footer>
    </div>

    <CalibrationOverlay v-if="calibrating"
      @cancel="calibrating = false"
      @finish="onCalibrationFinish" />
  </div>
</template>

<script>
import IconButton from './common/IconButton.vue'
import LayoutTab from './settings/LayoutTab.vue'
import TouchTab from './settings/TouchTab.vue'
import MidiTab from './settings/MidiTab.vue'
import CalibrationOverlay from './settings/CalibrationOverlay.vue'

const TAB_STORAGE_KEY = 'touchmpe-settings-tab'

export default {
  name: 'SettingsPanel',
  components: { IconButton, LayoutTab, TouchTab, MidiTab, CalibrationOverlay },

  props: {
    settings: { type: Object, required: true },
    midiOutputs: { type: Array, default: () => [] },
    midiInputs: { type: Array, default: () => [] },
    midiOutputName: { type: String, default: null },
    midiInputName: { type: String, default: null }
  },

  emits: ['update', 'close', 'select-output', 'select-input', 'toggle-mpe', 'panic'],

  data() {
    return {
      activeTab: localStorage.getItem(TAB_STORAGE_KEY) || 'layout',
      calibrating: false,
      tabs: [
        { id: 'layout', label: 'Layout' },
        { id: 'touch', label: 'Touch' },
        { id: 'mpe', label: 'MIDI' }
      ]
    }
  },

  watch: {
    activeTab(val) {
      try { localStorage.setItem(TAB_STORAGE_KEY, val) } catch (e) {}
    }
  },

  methods: {
    onCalibrationFinish(calibration) {
      this.calibrating = false
      this.$emit('update', { ...this.settings, velocityCalibration: calibration })
    }
  }
}
</script>

<style lang="sass">
.settings-modal
  width: min(480px, 100%)
  max-height: min(720px, 100%)
  box-shadow: var(--shadow-elevation)
  overflow: hidden

@media (max-width: 600px)
  .modal-overlay
    padding: 0
  .settings-modal
    width: 100%
    height: 100%
    max-height: 100%
    border-radius: 0
    border: none

.settings-header
  display: flex
  justify-content: space-between
  align-items: center
  padding: 14px var(--space-4)
  border-bottom: var(--border-hairline) solid var(--color-border)

  h2
    font-size: var(--text-lg)
    color: var(--color-accent)

.settings-tabs
  display: flex
  border-bottom: var(--border-hairline) solid var(--color-border)
  background: var(--color-bg-tab)

  button
    flex: 1
    background: none
    border: none
    color: var(--color-text-muted)
    font-size: var(--text-md)
    padding: var(--space-3) var(--space-2)
    cursor: pointer
    border-bottom: var(--border-thick) solid transparent
    transition: color var(--transition-fast), border-color var(--transition-fast)
    min-height: 44px

    &:hover
      color: var(--color-text)
    &.active
      color: var(--color-accent)
      border-bottom-color: var(--color-accent)

.settings-body
  flex: 1
  overflow-y: auto

  section
    padding: var(--space-4)
    border-top: var(--border-hairline) solid var(--color-border)
    &:first-child
      border-top: none

  h3
    font-size: var(--text-sm)
    color: var(--color-text-muted)
    text-transform: uppercase
    letter-spacing: 1.5px
    margin: 0 0 var(--space-3)

  select
    width: 160px
  input[type="number"]
    width: 72px

  .btn
    margin-top: var(--space-1)

.compound-input
  display: flex
  gap: var(--space-2)
  align-items: center
  select
    width: 72px
  input[type="number"]
    width: 60px
  .unit
    font-size: var(--text-sm)
    color: var(--color-text-faint)

.calibration-row
  display: flex
  gap: var(--space-2)
  margin-bottom: var(--space-3)

.calibration-status
  font-size: var(--text-xs)
  color: var(--color-success)

.small-btn
  padding: var(--space-1) var(--space-2)
  font-size: var(--text-xs)
  min-height: 28px

.settings-build
  text-align: center
  font-size: var(--text-xs)
  color: var(--color-border-strong)
  padding: var(--space-2) 0
  border-top: var(--border-hairline) solid var(--color-surface-2)
</style>
