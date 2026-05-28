<template>
  <label class="field">
    <span class="field-label">{{ label }}</span>
    <slot />
  </label>
</template>

<script>
export default {
  name: 'Field',
  props: {
    label: { type: String, required: true }
  }
}
</script>

<style lang="sass">
.field
  display: flex
  justify-content: space-between
  align-items: center
  font-size: var(--text-md)
  color: var(--color-text-secondary)
  margin-bottom: var(--space-3)
</style>
