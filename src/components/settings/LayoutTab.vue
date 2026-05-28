<template>
  <section>
    <Field label="Pad Size">
      <RangeInput :model-value="settings.padScale" :min="0.5" :max="2.0" :step="0.05"
        :format="v => v.toFixed(2) + 'x'"
        @update:model-value="v => update('padScale', v)" />
    </Field>

    <Field label="Root Note">
      <div class="compound-input">
        <select :value="rootPitchClass" @change="updateRootNote(+$event.target.value, rootOctave)">
          <option v-for="(name, i) in NOTE_NAMES" :key="i" :value="i">{{ name }}</option>
        </select>
        <input type="number" :value="rootOctave" min="-1" max="8"
          @change="updateRootNote(rootPitchClass, +$event.target.value)" />
      </div>
    </Field>

    <Field label="Scale">
      <select :value="settings.scale" @change="update('scale', $event.target.value)">
        <option value="chromatic">Chromatic</option>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
        <option value="pentatonic">Pentatonic</option>
        <option value="blues">Blues</option>
        <option value="dorian">Dorian</option>
        <option value="mixolydian">Mixolydian</option>
      </select>
    </Field>

    <Field label="Scale Root">
      <select :value="settings.scaleRoot" @change="update('scaleRoot', +$event.target.value)">
        <option v-for="(name, i) in NOTE_NAMES" :key="i" :value="i">{{ name }}</option>
      </select>
    </Field>

    <button class="btn" @click="resetLayout">Reset Layout</button>
  </section>
</template>

<script>
import Field from '../common/Field.vue'
import RangeInput from '../common/RangeInput.vue'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default {
  name: 'LayoutTab',
  components: { Field, RangeInput },

  props: {
    settings: { type: Object, required: true }
  },

  emits: ['update'],

  data() {
    return { NOTE_NAMES }
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
