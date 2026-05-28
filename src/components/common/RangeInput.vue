<template>
  <div class="range-input">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @input="$emit('update:modelValue', +$event.target.value)"
    />
    <span class="range-value">{{ display }}</span>
  </div>
</template>

<script>
export default {
  name: 'RangeInput',

  props: {
    modelValue: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 1 },
    step: { type: Number, default: 0.01 },
    format: { type: Function, default: null }
  },

  emits: ['update:modelValue'],

  computed: {
    display() {
      return this.format ? this.format(this.modelValue) : this.modelValue
    }
  }
}
</script>

<style lang="sass">
.range-input
  display: flex
  align-items: center
  gap: var(--space-2)
  flex: 1
  max-width: 280px
  margin-left: var(--space-4)

  input[type="range"]
    flex: 1
    accent-color: var(--color-accent)
    height: 32px

  .range-value
    font-size: var(--text-sm)
    color: var(--color-text-muted)
    min-width: 36px
    text-align: right
</style>
