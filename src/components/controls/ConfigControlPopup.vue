<template>
  <div class="floating-popup" :class="{ 'is-dimmed': dimmed }">
    <template v-if="!changeMode">
      <label>
        Label
        <input type="text" :value="control.label" @input="onLabel($event.target.value)" />
      </label>
      <label v-for="(ccNum, key) in control.cc_num" :key="key">
        {{ ccLabel(key) }}
        <input type="number" :value="ccNum" min="0" max="127"
          @input="onCC(key, +$event.target.value)" />
      </label>
      <div class="config-actions">
        <button class="btn" @click="changeMode = true">Change</button>
        <button class="btn btn-danger" @click="$emit('delete')">Delete</button>
      </div>
    </template>
    <template v-else>
      <div class="add-controls-label">Change Type</div>
      <div class="add-controls-grid">
        <button v-for="t in CONTROL_TYPES" :key="t.id"
          :class="{ 'is-current': t.id === control.type }"
          @click="onChangeType(t.id)">
          <Icon :name="t.icon" :size="24" />
          <span>{{ t.label }}</span>
        </button>
      </div>
      <button class="btn" @click="changeMode = false">Cancel</button>
    </template>
  </div>
</template>

<script>
import Icon from '../Icon.vue'
import { CONTROL_TYPES } from '../../models/ControlTypes.js'

const CC_KEY_LABELS = { x: 'CC X-Axis', y: 'CC Y-Axis', value: 'CC Number' }

export default {
  name: 'ConfigControlPopup',
  components: { Icon },

  props: {
    control: { type: Object, required: true },
    dimmed: { type: Boolean, default: false }
  },

  emits: ['update-label', 'update-cc', 'change-type', 'delete'],

  data() {
    return { changeMode: false, CONTROL_TYPES }
  },

  watch: {
    'control.id'() {
      this.changeMode = false
    }
  },

  methods: {
    ccLabel(key) {
      if (Object.keys(this.control.cc_num).length === 1) return 'CC Number'
      return CC_KEY_LABELS[key] || ('CC ' + key)
    },

    onLabel(value) {
      this.$emit('update-label', value)
    },

    onCC(key, value) {
      this.$emit('update-cc', key, value)
    },

    onChangeType(newType) {
      this.changeMode = false
      this.$emit('change-type', newType)
    }
  }
}
</script>
