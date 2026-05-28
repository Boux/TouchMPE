<template>
  <div
    class="drag-number"
    :class="{ dragging }"
    :data-axis="axis"
  >
    <slot>{{ display }}</slot>
  </div>
</template>

<script>
import Hammer from 'hammerjs'

export default {
  name: 'DragNumber',

  props: {
    modelValue: { type: Number, required: true },
    min: { type: Number, default: -Infinity },
    max: { type: Number, default: Infinity },
    axis: { type: String, default: 'y' },
    sensitivity: { type: Number, default: 10 },
    display: { type: String, default: null }
  },

  emits: ['update:modelValue'],

  data() {
    return { dragging: false }
  },

  mounted() {
    this.startValue = this.modelValue
    this.hammer = new Hammer.Manager(this.$el, { touchAction: 'none' })
    this.hammer.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 1 }))

    this.hammer.on('panstart', () => {
      this.startValue = this.modelValue
      this.dragging = true
    })

    this.hammer.on('panmove', (e) => {
      const delta = this.axis === 'x' ? e.deltaX : -e.deltaY
      const steps = Math.trunc(delta / this.sensitivity)
      const next = Math.max(this.min, Math.min(this.max, this.startValue + steps))
      if (next !== this.modelValue) {
        this.$emit('update:modelValue', next)
      }
    })

    this.hammer.on('panend pancancel', () => {
      this.dragging = false
    })
  },

  beforeUnmount() {
    this.hammer?.destroy()
  }
}
</script>

<style lang="sass">
.drag-number
  display: inline-flex
  align-items: center
  justify-content: center
  user-select: none
  touch-action: none
  cursor: ns-resize

  &[data-axis="x"]
    cursor: ew-resize

  &.dragging
    opacity: 0.85
</style>
