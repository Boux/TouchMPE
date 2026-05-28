<template>
  <div ref="root" class="tuning-row">
    <span class="note">{{ noteLabel }}</span>
    <DragNumber
      :class="['delta', { overridden }]"
      :min="-12"
      :max="24"
      :model-value="offset"
      @update:model-value="v => $emit('update', v)"
    >
      {{ formattedOffset }}
    </DragNumber>
  </div>
</template>

<script>
import Hammer from 'hammerjs'
import DragNumber from './DragNumber.vue'

export default {
  name: 'TuningRow',
  components: { DragNumber },

  props: {
    noteLabel: { type: String, required: true },
    offset: { type: Number, required: true },
    overridden: { type: Boolean, default: false }
  },

  emits: ['update', 'clear'],

  computed: {
    formattedOffset() {
      return this.offset >= 0 ? `+${this.offset}` : `${this.offset}`
    }
  },

  mounted() {
    this.hammer = new Hammer.Manager(this.$refs.root)
    this.hammer.add(new Hammer.Tap({ event: 'doubletap', taps: 2 }))
    this.hammer.on('doubletap', () => {
      if (this.overridden) this.$emit('clear')
    })
  },

  beforeUnmount() {
    this.hammer?.destroy()
  }
}
</script>

<style lang="sass">
.tuning-row
  display: flex
  align-items: center
  background: var(--color-surface-2)
  border-radius: var(--radius-md)
  padding: var(--space-2) var(--space-3)
  min-height: 40px
  min-width: 0
  gap: var(--space-2)

  .note
    flex: 1
    min-width: 0
    font-size: var(--text-md)
    font-variant-numeric: tabular-nums
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  .delta
    font-size: var(--text-lg)
    color: var(--color-text-muted)
    font-variant-numeric: tabular-nums
    min-width: 36px
    padding: var(--space-1) var(--space-2)
    border-radius: var(--radius-sm)

    &.overridden
      color: var(--color-accent)
      background: rgba(0, 0, 0, 0.3)
</style>
