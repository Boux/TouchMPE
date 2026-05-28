<template>
  <button class="icon-btn" :class="{ active }" @click="$emit('click', $event)">
    <Icon :name="name" :size="size" />
  </button>
</template>

<script>
import Icon from '../Icon.vue'

export default {
  name: 'IconButton',
  components: { Icon },

  props: {
    name: { type: String, required: true },
    size: { type: Number, default: 16 },
    active: { type: Boolean, default: false }
  },

  emits: ['click']
}
</script>

<style lang="sass">
.icon-btn
  &.active
    color: var(--color-accent)
</style>
