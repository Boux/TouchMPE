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
          Preset
          <select :value="settings.preset" @change="applyPreset($event.target.value)">
            <option value="chromatic">Chromatic</option>
            <option value="guitar">Guitar</option>
            <option value="thirds">Thirds</option>
            <option value="fifths">Fifths</option>
            <option value="wickiHayden">Wicki-Hayden</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          Columns
          <input type="number" :value="settings.cols" min="4" max="20"
            @change="update('cols', +$event.target.value)" />
        </label>

        <label>
          Rows
          <input type="number" :value="settings.rows" min="2" max="10"
            @change="update('rows', +$event.target.value)" />
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
      </div>

      <div class="settings-section">
        <h3>Touch</h3>

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
          <select :value="settings.slidePitchQuantize ? 'quantize' : 'continuous'"
            @change="update('slidePitchQuantize', $event.target.value === 'quantize')">
            <option value="continuous">Continuous</option>
            <option value="quantize">Quantize</option>
          </select>
        </label>

        <label>
          Pressure
          <select :value="settings.pressureMode"
            @change="update('pressureMode', $event.target.value)">
            <option value="auto">Auto</option>
            <option value="force">Force</option>
            <option value="area">Contact Area</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
      </div>

      <div class="settings-section">
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
    </div>
  </div>
</template>

<script>
import { PRESETS } from '../layout/KeyboardLayout.js'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default {
  name: 'SettingsPanel',

  props: {
    settings: { type: Object, required: true }
  },

  emits: ['update', 'close'],

  data() {
    return {
      noteNames: NOTE_NAMES
    }
  },

  computed: {
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

    applyPreset(presetName) {
      const preset = PRESETS[presetName]
      if (preset) {
        this.$emit('update', {
          ...this.settings,
          preset: presetName,
          rowOffset: preset.rowOffset,
          colOffset: preset.colOffset
        })
      } else {
        this.$emit('update', { ...this.settings, preset: presetName })
      }
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
    color: #ff8800

.close-btn
  background: none
  border: none
  color: #888
  font-size: 16px
  cursor: pointer

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
    font-size: 13px
    color: #aaa
    margin-bottom: 8px

  select, input[type="number"]
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 3px
    padding: 3px 6px
    font-size: 13px

  select
    width: 100px

  input[type="number"]
    width: 60px

.compound-input
  display: flex
  align-items: center
  gap: 4px

  select
    width: 60px

  input[type="number"]
    width: 48px

  .unit
    font-size: 11px
    color: #666
</style>
