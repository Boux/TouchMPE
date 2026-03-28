<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="$emit('close')">X</button>
      </div>

      <div class="settings-section">
        <h3>Keyboard Layout</h3>

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
          Row Offset (semitones)
          <input type="number" :value="settings.rowOffset" min="1" max="12"
            @change="update('rowOffset', +$event.target.value)" />
        </label>

        <label>
          Col Offset (semitones)
          <input type="number" :value="settings.colOffset" min="1" max="12"
            @change="update('colOffset', +$event.target.value)" />
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

        <button class="reset-btn" @click="resetLayout">Reset Layout</button>
      </div>

      <div v-if="settings.mpeMode !== false" class="settings-section">
        <h3>Touch</h3>

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
          <button class="reset-btn" @click="startCalibration">
            {{ settings.velocityCalibration ? 'Recalibrate' : 'Calibrate Velocity' }}
          </button>
          <span v-if="settings.velocityCalibration" class="calibration-status">calibrated</span>
          <button v-if="settings.velocityCalibration" class="reset-btn small-btn" @click="clearCalibration">
            Reset
          </button>
        </div>

        <!-- Calibration overlay -->
        <teleport to="body">
          <div v-if="calibrating" class="calibration-overlay" @pointerdown.prevent="onCalibrationTap">
            <div class="calibration-prompt">
              <div class="calibration-phase">{{ calibrationPhaseLabel }}</div>
              <div class="calibration-count">{{ calibrationSamples.length }} / 10</div>
              <div class="calibration-hint">Tap anywhere</div>
              <button class="reset-btn" @pointerdown.stop @click="cancelCalibration">Cancel</button>
            </div>
          </div>
        </teleport>

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
      </div>

      <div v-if="settings.mpeMode !== false" class="settings-section">
        <h3>MPE</h3>

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
      </div>

      <div class="settings-build">build 9</div>
    </div>
  </div>
</template>

<script>
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default {
  name: 'SettingsPanel',

  props: {
    settings: { type: Object, required: true }
  },

  emits: ['update', 'close'],

  data() {
    return {
      noteNames: NOTE_NAMES,
      calibrating: false,
      calibrationPhase: 0, // 0=soft, 1=medium, 2=hard
      calibrationSamples: [],
      calibrationData: { soft: [], medium: [], hard: [] }
    }
  },

  computed: {
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
        scale: 'chromatic',
        scaleRoot: 0
      })
    }
  }
}
</script>

<style lang="sass">
.settings-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.4)
  z-index: 100
  display: flex
  justify-content: flex-end

.settings-panel
  width: 280px
  height: 100%
  background: #222
  border-left: 1px solid #444
  padding: 16px
  overflow-y: auto

.settings-header
  display: flex
  justify-content: space-between
  align-items: center
  margin-bottom: 16px

  h2
    font-size: 16px
    color: var(--accent)

.reset-btn
  background: #333
  color: #ccc
  border: 1px solid #444
  border-radius: 6px
  padding: 8px
  font-size: 13px
  cursor: pointer
  min-height: 36px
  margin-top: 4px

  &:hover
    background: #444

.close-btn
  background: none
  border: none
  color: #888
  font-size: 20px
  cursor: pointer
  padding: 8px
  min-width: 40px
  min-height: 40px

  &:hover
    color: #fff

.settings-section
  margin-bottom: 20px

  h3
    font-size: 13px
    color: #888
    text-transform: uppercase
    letter-spacing: 1px
    margin-bottom: 10px
    border-bottom: 1px solid #333
    padding-bottom: 4px

  label
    display: flex
    justify-content: space-between
    align-items: center
    font-size: 15px
    color: #aaa
    margin-bottom: 12px

  select, input[type="number"]
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 6px
    padding: 8px 10px
    font-size: 16px
    min-height: 40px

  select
    width: 120px

  input[type="number"]
    width: 72px

.compound-input
  display: flex
  align-items: center
  gap: 6px

  select
    width: 72px

  input[type="number"]
    width: 60px

  .unit
    font-size: 13px
    color: #666

.slider-group
  display: flex
  align-items: center
  gap: 8px

  input[type="range"]
    width: 100px
    accent-color: var(--accent)
    height: 32px

  .slider-value
    font-size: 13px
    color: #888
    min-width: 40px

.calibration-row
  display: flex
  align-items: center
  gap: 8px
  margin-bottom: 12px

.calibration-status
  font-size: 11px
  color: #4c4

.small-btn
  padding: 4px 8px
  font-size: 11px
  min-height: 28px

.calibration-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.85)
  z-index: 200
  display: flex
  align-items: center
  justify-content: center
  touch-action: none

.calibration-prompt
  text-align: center
  display: flex
  flex-direction: column
  align-items: center
  gap: 16px

.calibration-phase
  font-size: 28px
  font-weight: 700
  color: var(--accent)
  text-transform: uppercase
  letter-spacing: 2px

.calibration-count
  font-size: 48px
  font-weight: 300
  color: #fff

.calibration-hint
  font-size: 14px
  color: #888

.settings-build
  text-align: center
  font-size: 11px
  color: #444
  padding: 16px 0 4px
</style>
