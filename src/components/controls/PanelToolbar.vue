<template>
  <div class="panel-toolbar">
    <div v-if="!locked" class="panel-toolbar-slider">
      <input type="range" :value="cellSize" min="30" max="120" step="5"
        @input="$emit('update-cell-size', +$event.target.value)" title="Zoom" />
    </div>
    <div v-if="locked" class="panel-toolbar-spacer"></div>
    <IconButton
      :name="locked ? 'lock-closed' : 'lock-open'"
      :size="16"
      :active="locked"
      class="layout-toggle"
      @click="$emit('toggle-lock')" />
    <IconButton
      v-if="!locked"
      name="move"
      :size="16"
      :active="layoutMode"
      class="layout-toggle"
      @click="$emit('toggle-layout-mode')" />
  </div>
</template>

<script>
import IconButton from '../common/IconButton.vue'

export default {
  name: 'PanelToolbar',
  components: { IconButton },

  props: {
    cellSize: { type: Number, required: true },
    locked: { type: Boolean, default: false },
    layoutMode: { type: Boolean, default: false }
  },

  emits: ['update-cell-size', 'toggle-lock', 'toggle-layout-mode']
}
</script>

<style lang="sass">
.panel-toolbar
  display: flex
  align-items: center
  gap: var(--space-2)
  padding: var(--space-1) var(--space-2)
  background: var(--color-surface)
  border-bottom: var(--border-hairline) solid var(--color-border)
  flex-shrink: 0

.panel-toolbar-spacer
  flex: 1

.panel-toolbar-slider
  display: flex
  align-items: center
  gap: var(--space-1)
  flex: 1
  min-width: 0

  input[type="range"]
    flex: 1
    min-width: 40px
    accent-color: var(--color-accent)
    height: 24px

.layout-toggle
  width: 28px
  height: 28px
  padding: var(--space-1)
  background: var(--color-surface-3)
  border: var(--border-hairline) solid var(--color-border-strong)
  border-radius: var(--radius-sm)
  color: var(--color-text-muted)
  min-width: 28px
  min-height: 28px

  &:hover
    background: var(--color-border-strong)
    color: var(--color-text)

  &.active
    background: var(--color-accent)
    color: var(--color-accent-text)
    border-color: var(--color-accent)
</style>
