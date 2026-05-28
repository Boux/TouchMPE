<template>
  <div class="floating-popup">
    <div class="add-controls-label">Add Control</div>
    <div class="add-controls-grid">
      <button v-for="t in CONTROL_TYPES" :key="t.id" @click="$emit('select', t.id)">
        <Icon :name="t.icon" :size="24" />
        <span>{{ t.label }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import Icon from '../Icon.vue'
import { CONTROL_TYPES } from '../../models/ControlTypes.js'

export default {
  name: 'AddControlPopup',
  components: { Icon },

  emits: ['select'],

  data() {
    return { CONTROL_TYPES }
  }
}
</script>
