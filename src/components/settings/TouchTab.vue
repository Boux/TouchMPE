<template>
  <section>
    <h3>Velocity</h3>

    <Field label="Velocity">
      <select :value="settings.velocityMode" @change="update('velocityMode', $event.target.value)">
        <option value="area">Calibrated</option>
        <option value="fixed">Fixed</option>
      </select>
    </Field>

    <Field v-if="settings.velocityMode === 'fixed'" label="Fixed Velocity">
      <RangeInput
        :model-value="Math.round((settings.fixedVelocity ?? 0.75) * 127)"
        :min="1" :max="127" :step="1"
        @update:model-value="v => update('fixedVelocity', v / 127)" />
    </Field>

    <div v-if="settings.velocityMode === 'area'" class="calibration-row">
      <button class="btn" @click="$emit('start-calibration')">
        {{ settings.velocityCalibration ? 'Recalibrate' : 'Calibrate Velocity' }}
      </button>
      <span v-if="settings.velocityCalibration" class="calibration-status">calibrated</span>
      <button v-if="settings.velocityCalibration" class="btn small-btn" @click="update('velocityCalibration', null)">
        Reset
      </button>
    </div>
  </section>

  <section>
    <h3>MPE</h3>

    <Field label="Note-On Pitch">
      <select :value="settings.noteOnQuantize ? 'quantize' : 'continuous'"
        @change="update('noteOnQuantize', $event.target.value === 'quantize')">
        <option value="quantize">Quantize</option>
        <option value="continuous">Continuous</option>
      </select>
    </Field>

    <Field label="Slide-To Pitch">
      <select :value="settings.slidePitchMode" @change="update('slidePitchMode', $event.target.value)">
        <option value="continuous">Continuous</option>
        <option value="assist">Assist</option>
        <option value="instant">Instant</option>
      </select>
    </Field>

    <template v-if="settings.slidePitchMode === 'assist'">
      <Field label="Assist Strength">
        <select :value="settings.gravityPreset" @change="applyGravityPreset($event.target.value)">
          <option value="weak">Weak</option>
          <option value="medium">Medium</option>
          <option value="strong">Strong</option>
          <option value="custom">Custom</option>
        </select>
      </Field>

      <template v-if="settings.gravityPreset === 'custom'">
        <Field label="Gravity Radius">
          <RangeInput :model-value="settings.gravityRadius" :min="0" :max="1" :step="0.05"
            :format="v => v.toFixed(2)"
            @update:model-value="v => update('gravityRadius', v)" />
        </Field>
        <Field label="Gravity Strength">
          <RangeInput :model-value="settings.gravityStrength" :min="0" :max="1" :step="0.05"
            :format="v => v.toFixed(2)"
            @update:model-value="v => update('gravityStrength', v)" />
        </Field>
        <Field label="Gravity Decay">
          <RangeInput :model-value="settings.gravityDecay" :min="0.05" :max="1" :step="0.05"
            :format="v => v.toFixed(2)"
            @update:model-value="v => update('gravityDecay', v)" />
        </Field>
      </template>
    </template>

    <Field label="Timbre Distance">
      <div class="compound-input">
        <input type="number" :value="settings.timbreDistance" min="1" max="8"
          @change="update('timbreDistance', +$event.target.value)" />
        <span class="unit">rows</span>
      </div>
    </Field>

    <Field label="Slide Highlight">
      <select :value="settings.slideHighlight || 'follow'" @change="update('slideHighlight', $event.target.value)">
        <option value="follow">Follows Pitch</option>
        <option value="origin">Pressed Note</option>
      </select>
    </Field>
  </section>

  <section>
    <h3>MIDI</h3>

    <Field label="Slide Behavior">
      <select :value="settings.slideBehavior || 'hold'" @change="update('slideBehavior', $event.target.value)">
        <option value="hold">Hold Note</option>
        <option value="retrigger">Retrigger</option>
      </select>
    </Field>
  </section>
</template>

<script>
import Field from '../common/Field.vue'
import RangeInput from '../common/RangeInput.vue'
import { GRAVITY_PRESETS } from '../../models/GravityPresets.js'

export default {
  name: 'TouchTab',
  components: { Field, RangeInput },

  props: {
    settings: { type: Object, required: true }
  },

  emits: ['update', 'start-calibration'],

  methods: {
    update(key, value) {
      this.$emit('update', { ...this.settings, [key]: value, preset: 'custom' })
    },

    applyGravityPreset(name) {
      const values = GRAVITY_PRESETS[name] || {}
      this.$emit('update', { ...this.settings, gravityPreset: name, ...values })
    }
  }
}
</script>
