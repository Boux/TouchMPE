<template>
  <div class="toolbar">
    <svg class="toolbar-logo" viewBox="0 0 512 512" @click="$refs.colorPicker.click()" @contextmenu.prevent="$emit('accent-change', null)">
      <rect width="512" height="512" rx="64" fill="#1a1a1a"/>
      <rect x="48" y="48" width="120" height="120" rx="16" :fill="settings.accentColor"/>
      <rect x="196" y="48" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.8"/>
      <rect x="344" y="48" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.6"/>
      <rect x="48" y="196" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.8"/>
      <rect x="196" y="196" width="120" height="120" rx="16" :fill="settings.accentColor"/>
      <rect x="344" y="196" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.8"/>
      <rect x="48" y="344" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.6"/>
      <rect x="196" y="344" width="120" height="120" rx="16" :fill="settings.accentColor" opacity="0.8"/>
      <rect x="344" y="344" width="120" height="120" rx="16" :fill="settings.accentColor"/>
    </svg>
    <input ref="colorPicker" type="color" :value="settings.accentColor"
      @input="$emit('accent-change', $event.target.value)"
      style="display:none" />

    <button class="toolbar-btn small tuning-btn" :class="{ active: tuningOpen }" @click="$emit('toggle-tuning')">
      {{ rootLabel }}
    </button>

    <div class="toolbar-spacer"></div>

    <span
      class="midi-status"
      :class="{ connected: midiOutputName }"
    ></span>

    <button class="toolbar-btn" @click="menuOpen = !menuOpen">
      {{ settings.mpeMode ? 'MPE' : 'MIDI' }}
    </button>

    <button class="toolbar-btn" :class="{ active: controlsOpen }" @click="$emit('toggle-controls')">
      CC
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
          MIDI Input
          <select
            :value="selectedInputId"
            @change="$emit('select-input', $event.target.value); menuOpen = false"
          >
            <option value="">None</option>
            <option
              v-for="input in midiInputs"
              :key="input.id"
              :value="input.id"
            >
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

        <button class="btn btn-danger btn-block" @click="$emit('panic'); menuOpen = false">
          Panic (All Notes Off)
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { noteNameWithOctave } from '../layout/NoteUtils.js'

export default {
  name: 'Toolbar',

  props: {
    settings: { type: Object, required: true },
    midiOutputName: { type: String, default: null },
    midiInputName: { type: String, default: null },
    midiOutputs: { type: Array, default: () => [] },
    midiInputs: { type: Array, default: () => [] },
    settingsOpen: { type: Boolean, default: false },
    controlsOpen: { type: Boolean, default: false },
    tuningOpen: { type: Boolean, default: false }
  },

  emits: ['select-output', 'select-input', 'toggle-settings', 'toggle-controls', 'toggle-mpe', 'toggle-tuning', 'panic', 'accent-change'],

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

    selectedInputId() {
      return this.midiInputName
        ? (this.midiInputs.find(i => i.name === this.midiInputName)?.id || '')
        : ''
    },

    rootLabel() {
      return noteNameWithOctave(this.settings.rootNote)
    }
  }
}
</script>

<style lang="sass">
.toolbar
  display: flex
  align-items: center
  gap: var(--space-2)
  height: 36px
  padding: 0 var(--space-2)
  background: var(--color-surface)
  border-bottom: var(--border-hairline) solid var(--color-border)
  flex-shrink: 0
  position: relative

.toolbar-logo
  width: 20px
  height: 20px
  border-radius: var(--radius-sm)
  cursor: pointer

.tuning-btn
  font-variant-numeric: tabular-nums
  min-width: 32px

.toolbar-spacer
  flex: 1

.midi-status
  width: var(--space-2)
  height: var(--space-2)
  border-radius: var(--radius-circle)
  background: var(--color-text-dim)
  flex-shrink: 0

  &.connected
    background: var(--color-success)
    box-shadow: 0 0 4px var(--color-success)

.toolbar-btn
  background: var(--color-surface-3)
  color: var(--color-text)
  border: var(--border-hairline) solid var(--color-border-strong)
  border-radius: var(--radius-sm)
  padding: var(--space-1) var(--space-3)
  font-size: var(--text-sm)
  cursor: pointer
  white-space: nowrap
  flex-shrink: 0

  &:hover
    background: var(--color-border-strong)

  &.active
    background: var(--color-accent)
    color: var(--color-accent-text)
    border-color: var(--color-accent)

  &.small
    padding: var(--space-1) var(--space-2)
    font-size: var(--text-xs)
    min-width: 24px

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
