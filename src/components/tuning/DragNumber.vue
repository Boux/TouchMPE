<template>
  <div
    class="drag-number"
    :class="{ dragging }"
    :data-axis="axis"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <slot>{{ display }}</slot>
  </div>
</template>

<script>
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
    return {
      dragging: false,
      startPos: 0,
      startValue: 0
    }
  },

  methods: {
    onDown(e) {
      e.preventDefault()
      this.$el.setPointerCapture(e.pointerId)
      this.dragging = true
      this.startPos = this.axis === 'x' ? e.clientX : e.clientY
      this.startValue = this.modelValue
    },

    onMove(e) {
      if (!this.dragging) return
      const pos = this.axis === 'x' ? e.clientX : e.clientY
      const raw = this.axis === 'x' ? pos - this.startPos : this.startPos - pos
      const steps = Math.trunc(raw / this.sensitivity)
      const next = Math.max(this.min, Math.min(this.max, this.startValue + steps))
      if (next !== this.modelValue) {
        this.$emit('update:modelValue', next)
      }
    },

    onUp(e) {
      if (!this.dragging) return
      this.dragging = false
      try { this.$el.releasePointerCapture(e.pointerId) } catch (err) {}
    }
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
