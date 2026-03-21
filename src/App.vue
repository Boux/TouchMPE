<template>
  <div class="app">
    <Toolbar
      :midi-output-name="midiOutputName"
      :midi-outputs="midiOutputs"
      :settings-open="settingsOpen"
      @select-output="onSelectOutput"
      @toggle-settings="settingsOpen = !settingsOpen"
    />
    <GridCanvas
      ref="gridCanvas"
      :settings="settings"
      :midi-output="midiOutput"
      @engine-ready="onEngineReady"
    />
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
import MIDIOutput from './midi/MIDIOutput.js'
import { loadSettings, saveSettings } from './store/settings.js'

export default {
  name: 'App',
  components: { GridCanvas, Toolbar, SettingsPanel },

  data() {
    return {
      settingsOpen: false,
      settings: loadSettings(),
      midiOutput: new MIDIOutput(),
      midiOutputs: [],
      midiOutputName: null,
      engine: null
    }
  },

  async mounted() {
    try {
      await this.midiOutput.init()
      this.midiOutputs = this.midiOutput.getOutputs()
      this.midiOutput.onStateChange = (outputs) => {
        this.midiOutputs = outputs
      }
      // Auto-select first output if available
      if (this.midiOutputs.length > 0) {
        this.onSelectOutput(this.midiOutputs[0].id)
      }
    } catch (err) {
      console.error('MIDI init failed:', err.message)
    }

    // Send All Notes Off on page unload
    window.addEventListener('beforeunload', () => {
      if (this.engine) this.engine.panic()
    })

    // Panic on visibility change (tab hidden, screen off)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.engine) this.engine.panic()
    })
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
    }
  }
}
</script>

<style lang="sass">
*
  margin: 0
  padding: 0
  box-sizing: border-box

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
</style>
