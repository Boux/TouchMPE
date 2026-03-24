<template>
  <div class="app">
    <Toolbar
      :settings="settings"
      :midi-output-name="midiOutputName"
      :midi-input-name="midiInputName"
      :midi-outputs="midiOutputs"
      :settings-open="settingsOpen"
      :midi-inputs="midiInputs"
      :controls-open="controlConfig.visible"
      @select-output="onSelectOutput"
      @toggle-settings="settingsOpen = !settingsOpen"
      @octave-up="shiftOctave(1)"
      @octave-down="shiftOctave(-1)"
      @preset-change="onPresetChange"
      @panic="onPanic"
      @toggle-mpe="onToggleMpe"
      @select-input="onSelectInput"
      @toggle-controls="toggleControlPanel"
      @accent-change="onAccentChange"
    />
    <div class="main-area" :class="'dock-' + controlConfig.dockSide" :data-cc-visible="controlConfig.visible">
      <GridCanvas
        ref="gridCanvas"
        :settings="settings"
        :midi-output="midiOutput"
        @engine-ready="onEngineReady"
      />
      <ControlPanel
        v-if="controlConfig.visible"
        :config="controlConfig"
        :engine="engine"
        :accent-color="settings.accentColor || '#ff8800'"
        @update="onControlConfigUpdate"
      />
    </div>
    <SettingsPanel
      v-if="settingsOpen"
      :settings="settings"
      @update="onSettingsUpdate"
      @close="settingsOpen = false"
    />
  </div>
</template>

<script>
import GridCanvas from './components/GridCanvas.vue'
import Toolbar from './components/Toolbar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ControlPanel from './components/ControlPanel.vue'
import MIDIOutput from './midi/MIDIOutput.js'
import { PRESETS } from './layout/KeyboardLayout.js'
import { loadSettings, saveSettings } from './store/settings.js'
import { loadControlConfig, saveControlConfig } from './store/controlConfig.js'

export default {
  name: 'App',
  components: { GridCanvas, Toolbar, SettingsPanel, ControlPanel },

  data() {
    return {
      settingsOpen: false,
      settings: loadSettings(),
      controlConfig: loadControlConfig(),
      midiOutput: new MIDIOutput(),
      midiOutputs: [],
      midiInputs: [],
      midiOutputName: null,
      midiInputName: null,
      engine: null
    }
  },

  async mounted() {
    try {
      await this.midiOutput.init()
      this.midiOutputs = this.midiOutput.getOutputs()
      this.midiInputs = this.midiOutput.getInputs()
      this.midiOutput.onStateChange = (outputs, inputs) => {
        this.midiOutputs = outputs
        this.midiInputs = inputs
      }
      if (this.midiOutputs.length > 0) {
        this.onSelectOutput(this.midiOutputs[0].id)
      }
    } catch (err) {
      console.error('MIDI init failed:', err.message)
    }

    window.addEventListener('beforeunload', () => {
      if (this.engine) this.engine.panic()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.engine) this.engine.panic()
    })

    this._applyAccentColor(this.settings.accentColor)
  },

  methods: {
    onSelectOutput(id) {
      this.midiOutput.selectOutput(id)
      this.midiOutputName = this.midiOutput.selectedName
      if (this.engine) {
        this.engine.sendConfig()
      }
    },

    onEngineReady(engine) {
      this.engine = engine
      this.engine.applySettings(this.settings)
      if (this.midiOutput.output) {
        this.engine.sendConfig()
      }
    },

    onSettingsUpdate(newSettings) {
      Object.assign(this.settings, newSettings)
      saveSettings(this.settings)
      if (this.$refs.gridCanvas) {
        this.$refs.gridCanvas.applySettings(this.settings)
      }
    },

    onPresetChange(presetName) {
      const preset = PRESETS[presetName]
      if (preset) {
        this.onSettingsUpdate({
          ...this.settings,
          preset: presetName,
          rowOffset: preset.rowOffset,
          colOffset: preset.colOffset
        })
      }
    },

    shiftOctave(direction) {
      const newRoot = this.settings.rootNote + direction * 12
      if (newRoot >= 0 && newRoot <= 127) {
        this.onSettingsUpdate({ ...this.settings, rootNote: newRoot })
      }
    },

    onPanic() {
      if (this.engine) this.engine.panic()
    },

    onSelectInput(id) {
      if (id) {
        this.midiOutput.selectInput(id)
        this.midiInputName = this.midiOutput.selectedInputName
        this.midiOutput.onNoteOn = (note) => {
          if (this.$refs.gridCanvas?.renderer) {
            this.$refs.gridCanvas.renderer.externalNoteOn(note)
          }
        }
        this.midiOutput.onNoteOff = (note) => {
          if (this.$refs.gridCanvas?.renderer) {
            this.$refs.gridCanvas.renderer.externalNoteOff(note)
          }
        }
      } else {
        this.midiOutput.selectInput(null)
        this.midiInputName = null
        this.midiOutput.onNoteOn = null
        this.midiOutput.onNoteOff = null
      }
    },

    onToggleMpe(mpeMode) {
      this.onSettingsUpdate({ ...this.settings, mpeMode })
    },

    toggleControlPanel() {
      this.controlConfig.visible = !this.controlConfig.visible
      saveControlConfig(this.controlConfig)
    },

    onControlConfigUpdate(config) {
      Object.assign(this.controlConfig, config)
      saveControlConfig(this.controlConfig)
    },

    onAccentChange(color) {
      const resolved = color || '#ff8800'
      this._applyAccentColor(resolved)
      this.onSettingsUpdate({ ...this.settings, accentColor: resolved })
    },

    _applyAccentColor(color) {
      document.documentElement.style.setProperty('--accent', color)
    }
  }
}
</script>

<style lang="sass">
*
  margin: 0
  padding: 0
  box-sizing: border-box

\:root
  --accent-default: #ff8800
  --accent: var(--accent-default)

html, body
  width: 100%
  height: 100%
  overflow: hidden
  background: #1a1a1a
  color: #ccc
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

#app
  width: 100%
  height: 100%

.app
  display: flex
  flex-direction: column
  width: 100%
  height: 100%

.main-area
  display: flex
  flex: 1
  min-height: 0

  &.dock-left
    flex-direction: row-reverse

  &.dock-right
    flex-direction: row

  &.dock-top
    flex-direction: column-reverse

  &.dock-bottom
    flex-direction: column
</style>
