<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal settings-modal">
      <header class="settings-header">
        <h2>Settings</h2>
        <button class="icon-btn" @click="$emit('close')" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </header>

      <nav class="settings-tabs">
        <button v-for="tab in tabs" :key="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </nav>

      <div class="settings-body">
        <template v-if="activeTab === 'layout'">
          <section>
            <label>
              Pad Size
              <div class="slider-group">
                <input type="range" :value="settings.padScale" min="0.5" max="2.0" step="0.05"
                  @input="update('padScale', +$event.target.value)" />
                <span class="slider-value">{{ (settings.padScale || 1).toFixed(2) }}x</span>
              </div>
            </label>

            <label>
              Root Note
              <div class="compound-input">
                <select :value="rootPitchClass" @change="updateRootNote(+$event.target.value, rootOctave)">
                  <option v-for="(name, i) in noteNames" :key="i" :value="i">{{ name }}</option>
                </select>
                <input type="number" :value="rootOctave" min="-1" max="8"
                  @change="updateRootNote(rootPitchClass, +$event.target.value)" />
              </div>
            </label>

            <label>
              Scale
              <select :value="settings.scale"
                @change="update('scale', $event.target.value)">
                <option value="chromatic">Chromatic</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="pentatonic">Pentatonic</option>
                <option value="blues">Blues</option>
                <option value="dorian">Dorian</option>
                <option value="mixolydian">Mixolydian</option>
              </select>
            </label>

            <label>
              Scale Root
              <select :value="settings.scaleRoot"
                @change="update('scaleRoot', +$event.target.value)">
                <option v-for="(name, i) in noteNames" :key="i" :value="i">{{ name }}</option>
              </select>
            </label>

            <button class="btn" @click="resetLayout">Reset Layout</button>
          </section>
        </template>

        <template v-if="activeTab === 'touch'">
          <section>
            <h3>Velocity</h3>

            <label>
              Velocity
              <select :value="settings.velocityMode"
                @change="update('velocityMode', $event.target.value)">
                <option value="area">Calibrated</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>

            <label v-if="settings.velocityMode === 'fixed'">
              Fixed Velocity
              <div class="slider-group">
                <input type="range" :value="Math.round((settings.fixedVelocity ?? 0.75) * 127)" min="1" max="127" step="1"
                  @input="update('fixedVelocity', +$event.target.value / 127)" />
                <span class="slider-value">{{ Math.round((settings.fixedVelocity ?? 0.75) * 127) }}</span>
              </div>
            </label>

            <div v-if="settings.velocityMode === 'area'" class="calibration-row">
              <button class="btn" @click="startCalibration">
                {{ settings.velocityCalibration ? 'Recalibrate' : 'Calibrate Velocity' }}
              </button>
              <span v-if="settings.velocityCalibration" class="calibration-status">calibrated</span>
              <button v-if="settings.velocityCalibration" class="btn small-btn" @click="clearCalibration">
                Reset
              </button>
            </div>
          </section>

          <section>
            <h3>MPE</h3>

            <label>
              Note-On Pitch
              <select :value="settings.noteOnQuantize ? 'quantize' : 'continuous'"
                @change="update('noteOnQuantize', $event.target.value === 'quantize')">
                <option value="quantize">Quantize</option>
                <option value="continuous">Continuous</option>
              </select>
            </label>

            <label>
              Slide-To Pitch
              <select :value="settings.slidePitchMode"
                @change="update('slidePitchMode', $event.target.value)">
                <option value="continuous">Continuous</option>
                <option value="assist">Assist</option>
                <option value="instant">Instant</option>
              </select>
            </label>

            <template v-if="settings.slidePitchMode === 'assist'">
              <label>
                Assist Strength
                <select :value="settings.gravityPreset"
                  @change="applyGravityPreset($event.target.value)">
                  <option value="weak">Weak</option>
                  <option value="medium">Medium</option>
                  <option value="strong">Strong</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <template v-if="settings.gravityPreset === 'custom'">
                <label>
                  Gravity Radius
                  <div class="slider-group">
                    <input type="range" :value="settings.gravityRadius" min="0" max="1" step="0.05"
                      @input="update('gravityRadius', +$event.target.value)" />
                    <span class="slider-value">{{ (settings.gravityRadius ?? 0.5).toFixed(2) }}</span>
                  </div>
                </label>

                <label>
                  Gravity Strength
                  <div class="slider-group">
                    <input type="range" :value="settings.gravityStrength" min="0" max="1" step="0.05"
                      @input="update('gravityStrength', +$event.target.value)" />
                    <span class="slider-value">{{ (settings.gravityStrength ?? 0.5).toFixed(2) }}</span>
                  </div>
                </label>

                <label>
                  Gravity Decay
                  <div class="slider-group">
                    <input type="range" :value="settings.gravityDecay" min="0.05" max="1" step="0.05"
                      @input="update('gravityDecay', +$event.target.value)" />
                    <span class="slider-value">{{ (settings.gravityDecay ?? 0.5).toFixed(2) }}</span>
                  </div>
                </label>
              </template>
            </template>

            <label>
              Timbre Distance
              <div class="compound-input">
                <input type="number" :value="settings.timbreDistance" min="1" max="8"
                  @change="update('timbreDistance', +$event.target.value)" />
                <span class="unit">rows</span>
              </div>
            </label>

            <label>
              Slide Highlight
              <select :value="settings.slideHighlight || 'follow'"
                @change="update('slideHighlight', $event.target.value)">
                <option value="follow">Follows Pitch</option>
                <option value="origin">Pressed Note</option>
              </select>
            </label>
          </section>

          <section>
            <h3>MIDI</h3>

            <label>
              Slide Behavior
              <select :value="settings.slideBehavior || 'hold'"
                @change="update('slideBehavior', $event.target.value)">
                <option value="hold">Hold Note</option>
                <option value="retrigger">Retrigger</option>
              </select>
            </label>
          </section>
        </template>

        <template v-if="activeTab === 'mpe'">
          <section>
            <label>
              Mode
              <select :value="settings.mpeMode ? 'mpe' : 'midi'"
                @change="$emit('toggle-mpe', $event.target.value === 'mpe')">
                <option value="mpe">MPE</option>
                <option value="midi">MIDI</option>
              </select>
            </label>

            <label>
              MIDI Output
              <select :value="selectedOutputId"
                @change="$emit('select-output', $event.target.value)">
                <option value="" disabled>Select...</option>
                <option v-for="output in midiOutputs" :key="output.id" :value="output.id">
                  {{ output.name }}
                </option>
              </select>
            </label>

            <label>
              MIDI Input
              <select :value="selectedInputId"
                @change="$emit('select-input', $event.target.value)">
                <option value="">None</option>
                <option v-for="input in midiInputs" :key="input.id" :value="input.id">
                  {{ input.name }}
                </option>
              </select>
            </label>

            <template v-if="settings.mpeMode !== false">
              <label>
                Pitch Bend Range
                <div class="compound-input">
                  <input type="number" :value="settings.pitchBendRange" min="1" max="96"
                    @change="update('pitchBendRange', +$event.target.value)" />
                  <span class="unit">st</span>
                </div>
              </label>

              <label>
                Member Channels
                <input type="number" :value="settings.memberChannels" min="1" max="15"
                  @change="update('memberChannels', +$event.target.value)" />
              </label>
            </template>

            <button class="btn btn-danger btn-block" @click="$emit('panic')">Panic (All Notes Off)</button>
          </section>
        </template>
      </div>

      <footer class="settings-build">build 11</footer>
    </div>

    <!-- Calibration overlay -->
    <teleport to="body">
      <div v-if="calibrating" class="calibration-overlay" @pointerdown.prevent="onCalibrationTap">
        <div class="calibration-prompt">
          <div class="calibration-phase">{{ calibrationPhaseLabel }}</div>
          <div class="calibration-count">{{ calibrationSamples.length }} / 10</div>
          <div class="calibration-hint">Tap anywhere</div>
          <button class="btn" @pointerdown.stop @click="cancelCalibration">Cancel</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const TAB_STORAGE_KEY = 'touchmpe-settings-tab'

export default {
  name: 'SettingsPanel',

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
      noteNames: NOTE_NAMES,
      activeTab: localStorage.getItem(TAB_STORAGE_KEY) || 'layout',
      calibrating: false,
      calibrationPhase: 0, // 0=soft, 1=medium, 2=hard
      calibrationSamples: [],
      calibrationData: { soft: [], medium: [], hard: [] }
    }
  },

  computed: {
    tabs() {
      return [
        { id: 'layout', label: 'Layout' },
        { id: 'touch', label: 'Touch' },
        { id: 'mpe', label: 'MIDI' }
      ]
    },

    selectedOutputId() {
      const match = this.midiOutputs.find(o => o.name === this.midiOutputName)
      return match ? match.id : ''
    },

    selectedInputId() {
      return this.midiInputName
        ? (this.midiInputs.find(i => i.name === this.midiInputName)?.id || '')
        : ''
    },

    calibrationPhaseLabel() {
      return ['Tap SOFTLY', 'Tap MEDIUM', 'Tap HARD'][this.calibrationPhase] || ''
    },

    rootPitchClass() {
      return this.settings.rootNote % 12
    },

    rootOctave() {
      return Math.floor(this.settings.rootNote / 12) - 1
    }
  },

  watch: {
    tabs(list) {
      if (!list.some(t => t.id === this.activeTab)) {
        this.activeTab = list[0]?.id || 'layout'
      }
    },
    activeTab(val) {
      try { localStorage.setItem(TAB_STORAGE_KEY, val) } catch (e) {}
    }
  },

  methods: {
    update(key, value) {
      this.$emit('update', { ...this.settings, [key]: value, preset: 'custom' })
    },

    updateRootNote(pitchClass, octave) {
      const midi = (octave + 1) * 12 + pitchClass
      const clamped = Math.max(0, Math.min(127, midi))
      this.$emit('update', { ...this.settings, rootNote: clamped, preset: 'custom' })
    },

    applyGravityPreset(name) {
      const presets = {
        weak: { gravityRadius: 0.35, gravityStrength: 0.20, gravityDecay: 0.20 },
        medium: { gravityRadius: 0.5, gravityStrength: 0.4, gravityDecay: 0.4 },
        strong: { gravityRadius: 0.8, gravityStrength: 0.75, gravityDecay: 0.75 }
      }
      const values = presets[name] || {}
      this.$emit('update', { ...this.settings, gravityPreset: name, ...values })
    },

    startCalibration() {
      this.calibrating = true
      this.calibrationPhase = 0
      this.calibrationSamples = []
      this.calibrationData = { soft: [], medium: [], hard: [] }
    },

    cancelCalibration() {
      this.calibrating = false
    },

    clearCalibration() {
      this.update('velocityCalibration', null)
    },

    onCalibrationTap(e) {
      const area = (e.width || 0) * (e.height || 0)
      if (area <= 0) return

      this.calibrationSamples.push(area)
      const phaseKey = ['soft', 'medium', 'hard'][this.calibrationPhase]
      this.calibrationData[phaseKey].push(area)

      if (this.calibrationSamples.length >= 10) {
        this.calibrationPhase++
        this.calibrationSamples = []

        if (this.calibrationPhase >= 3) {
          this.finishCalibration()
        }
      }
    },

    finishCalibration() {
      const median = arr => {
        const sorted = [...arr].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      }

      const soft = median(this.calibrationData.soft)
      const medium = median(this.calibrationData.medium)
      const hard = median(this.calibrationData.hard)

      this.calibrating = false
      this.update('velocityCalibration', { soft, medium, hard })
    },

    resetLayout() {
      this.$emit('update', {
        ...this.settings,
        padScale: 1.0,
        rootNote: 36,
        rowOffset: 5,
        colOffset: 1,
        rowOverrides: {},
        scale: 'chromatic',
        scaleRoot: 0
      })
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
  svg
    width: 20px
    height: 20px

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

  label
    display: flex
    justify-content: space-between
    align-items: center
    font-size: var(--text-md)
    color: var(--color-text-secondary)
    margin-bottom: var(--space-3)

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

.slider-group
  display: flex
  align-items: center
  gap: var(--space-2)
  flex: 1
  max-width: 280px
  margin-left: var(--space-4)

  input[type="range"]
    flex: 1
    accent-color: var(--color-accent)
    height: 32px

  .slider-value
    font-size: var(--text-sm)
    color: var(--color-text-muted)

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

.calibration-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.85)
  z-index: var(--z-calibration)
  display: flex
  align-items: center
  justify-content: center
  touch-action: none

.calibration-prompt
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--space-4)
  text-align: center
  color: var(--color-text-strong)

  .calibration-phase
    font-size: var(--text-2xl)
    color: var(--color-accent)
    text-transform: uppercase
    letter-spacing: 2px
  .calibration-count
    font-size: 48px
    font-weight: 300
  .calibration-hint
    font-size: var(--text-md)
    color: var(--color-text-muted)

.settings-build
  text-align: center
  font-size: var(--text-xs)
  color: var(--color-border-strong)
  padding: var(--space-2) 0
  border-top: var(--border-hairline) solid var(--color-surface-2)
</style>
