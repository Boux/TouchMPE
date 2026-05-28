<template>
  <div class="layout-overlay" :class="{ 'is-dragging': dragging }">
    <div class="layout-drag-area"
      @pointerdown.prevent="startDragSnap"
      @touchstart.prevent>
      <div class="layout-overlay-text">
        Drag to snap
        <button class="layout-done-btn"
          @pointerdown.stop
          @touchstart.stop
          @click.stop="$emit('done')">Done</button>
      </div>
    </div>
    <div class="layout-resize-edge"
      @pointerdown.prevent="startEdgeResize"
      @touchstart.prevent></div>
  </div>
</template>

<script>
export default {
  name: 'LayoutModeOverlay',

  props: {
    config: { type: Object, required: true }
  },

  emits: ['done', 'save'],

  data() {
    return { dragging: false }
  },

  methods: {
    startDragSnap(e) {
      if (e.target.closest('button')) return
      this.dragging = true
      const el = e.target.closest('.layout-drag-area')
      if (el) el.setPointerCapture(e.pointerId)
      const onMove = (e) => {
        const dists = {
          left: e.clientX,
          right: window.innerWidth - e.clientX,
          top: e.clientY,
          bottom: window.innerHeight - e.clientY
        }
        const closest = Object.keys(dists).reduce((a, b) => dists[a] < dists[b] ? a : b)
        if (this.config.dockSide !== closest) this.config.dockSide = closest
      }
      const onUp = () => {
        this.dragging = false
        this.$emit('save')
        el?.removeEventListener('pointermove', onMove)
        el?.removeEventListener('pointerup', onUp)
      }
      el?.addEventListener('pointermove', onMove)
      el?.addEventListener('pointerup', onUp)
    },

    startEdgeResize(e) {
      const parent = this.$el.parentElement?.parentElement
      if (!parent) return
      const edge = e.target
      edge.setPointerCapture(e.pointerId)
      const startX = e.clientX
      const startY = e.clientY
      const startPct = this.config.panelSize
      const rect = parent.getBoundingClientRect()
      const onMove = (e) => {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const side = this.config.dockSide
        let deltaPct
        if (side === 'right') deltaPct = -dx / rect.width * 100
        else if (side === 'left') deltaPct = dx / rect.width * 100
        else if (side === 'bottom') deltaPct = -dy / rect.height * 100
        else deltaPct = dy / rect.height * 100
        this.config.panelSize = Math.max(10, Math.min(80, startPct + deltaPct))
      }
      const onUp = () => {
        this.$emit('save')
        edge.releasePointerCapture(e.pointerId)
        edge.removeEventListener('pointermove', onMove)
        edge.removeEventListener('pointerup', onUp)
      }
      edge.addEventListener('pointermove', onMove)
      edge.addEventListener('pointerup', onUp)
    }
  }
}
</script>

<style lang="sass">
.layout-overlay
  position: absolute
  inset: 0
  z-index: var(--z-controls)
  display: flex

  .dock-left &, .dock-right &
    flex-direction: row
  .dock-top &, .dock-bottom &
    flex-direction: column
  .dock-right &
    flex-direction: row-reverse
  .dock-bottom &
    flex-direction: column-reverse

.layout-drag-area
  flex: 1
  background: color-mix(in srgb, var(--color-accent) 12%, transparent)
  backdrop-filter: blur(4px)
  border: var(--border-strip) dashed var(--color-accent)
  cursor: grab
  display: flex
  align-items: center
  justify-content: center

  .layout-overlay.is-dragging &
    cursor: grabbing
    background: color-mix(in srgb, var(--color-accent) 25%, transparent)

.layout-overlay-text
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--space-3)
  font-size: var(--text-lg)
  font-weight: 600
  color: var(--color-accent)
  text-transform: uppercase
  letter-spacing: 2px
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6)
  pointer-events: none

.layout-done-btn
  pointer-events: auto
  background: var(--color-accent)
  color: var(--color-accent-text)
  border: none
  border-radius: var(--radius-md)
  padding: var(--space-2) var(--space-5)
  font-size: var(--text-md)
  font-weight: 600
  cursor: pointer

.layout-resize-edge
  background: var(--color-surface-2)
  border: var(--border-thick) dotted var(--color-accent)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  &::after
    content: ''
    border-radius: var(--radius-sm)
    background: var(--color-accent)
    opacity: 0.6

  .dock-right &, .dock-left &
    width: 18px
    cursor: ew-resize
    flex-direction: column
    &::after
      width: var(--border-strip)
      height: 32px

  .dock-top &, .dock-bottom &
    height: 18px
    cursor: ns-resize
    &::after
      height: var(--border-strip)
      width: 32px
</style>
