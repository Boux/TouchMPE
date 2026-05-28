<template>
  <teleport to="body">
    <div class="calibration-overlay" @pointerdown.prevent="onTap">
      <div class="calibration-prompt">
        <div class="calibration-phase">{{ phaseLabel }}</div>
        <div class="calibration-count">{{ samples.length }} / 10</div>
        <div class="calibration-hint">Tap anywhere</div>
        <button class="btn" @pointerdown.stop @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </teleport>
</template>

<script>
const PHASE_LABELS = ['Tap SOFTLY', 'Tap MEDIUM', 'Tap HARD']

export default {
  name: 'CalibrationOverlay',

  emits: ['cancel', 'finish'],

  data() {
    return {
      phase: 0,
      samples: [],
      data: { soft: [], medium: [], hard: [] }
    }
  },

  computed: {
    phaseLabel() {
      return PHASE_LABELS[this.phase] || ''
    }
  },

  methods: {
    onTap(e) {
      const area = (e.width || 0) * (e.height || 0)
      if (area <= 0) return

      this.samples.push(area)
      const phaseKey = ['soft', 'medium', 'hard'][this.phase]
      this.data[phaseKey].push(area)

      if (this.samples.length >= 10) {
        this.phase++
        this.samples = []
        if (this.phase >= 3) this.finish()
      }
    },

    finish() {
      const median = arr => {
        const sorted = [...arr].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      }
      this.$emit('finish', {
        soft: median(this.data.soft),
        medium: median(this.data.medium),
        hard: median(this.data.hard)
      })
    }
  }
}
</script>

<style lang="sass">
.calibration-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.85)
  z-index: var(--z-calibration)
  display: flex
  align-items: center
  justify-content: center
  touch-action: none

.calibration-prompt
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--space-4)
  text-align: center
  color: var(--color-text-strong)

  .calibration-phase
    font-size: var(--text-2xl)
    color: var(--color-accent)
    text-transform: uppercase
    letter-spacing: 2px
  .calibration-count
    font-size: 48px
    font-weight: 300
  .calibration-hint
    font-size: var(--text-md)
    color: var(--color-text-muted)
</style>
