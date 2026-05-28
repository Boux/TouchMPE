<template>
  <div class="tuning-backdrop">
    <div class="tuning-overrides" @pointerdown.self="$emit('close')">
      <div
        v-for="i in nonRootIndices"
        :key="i"
        class="tuning-row-overlay"
        :style="rowStyle(i)"
      >
        <TuningRow
          :note-label="noteFor(i)"
          :offset="effectiveOffset(i - 1)"
          :overridden="hasOverride(i - 1)"
          @update="v => setOverride(i - 1, v)"
          @clear="clearOverride(i - 1)"
        />
      </div>
    </div>

    <div class="tuning-options" @pointerdown.self="$emit('close')">
      <div class="tuning-center">
        <DragNumber
          class="tuning-root"
          axis="x"
          :sensitivity="14"
          :min="0"
          :max="127"
          :model-value="settings.rootNote"
          @update:model-value="v => emitPatch({ rootNote: v })"
        >
          {{ rootLabel }}
        </DragNumber>

        <div class="tuning-globals">
          <div class="tuning-global">
            <span class="label">Row</span>
            <DragNumber class="value" :min="1" :max="12" :model-value="settings.rowOffset" @update:model-value="v => emitPatch({ rowOffset: v })">
              {{ settings.rowOffset }}
            </DragNumber>
          </div>
          <div class="tuning-global">
            <span class="label">Col</span>
            <DragNumber class="value" :min="1" :max="12" :model-value="settings.colOffset" @update:model-value="v => emitPatch({ colOffset: v })">
              {{ settings.colOffset }}
            </DragNumber>
          </div>
        </div>

        <div class="tuning-presets">
          <button
            v-for="(p, key) in presets"
            :key="key"
            :class="{ active: settings.preset === key }"
            @click="onPreset(key)"
          >{{ p.label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DragNumber from './DragNumber.vue'
import TuningRow from './TuningRow.vue'
import { PRESETS } from '../../layout/KeyboardLayout.js'
import { noteNameWithOctave } from '../../layout/NoteUtils.js'
import { calcGrid } from '../../store/settings.js'

const GRID_GAP = 3

export default {
  name: 'TuningOverlay',
  components: { DragNumber, TuningRow },

  props: {
    settings: { type: Object, required: true },
    canvasEl: { type: HTMLCanvasElement, default: null }
  },

  emits: ['update', 'close'],

  data() {
    return { rows: 0, rowPositions: [] }
  },

  computed: {
    presets() { return PRESETS },

    rootLabel() {
      return noteNameWithOctave(this.settings.rootNote)
    },

    cumulative() {
      const arr = new Array(this.rows)
      if (this.rows === 0) return arr
      arr[0] = 0
      const overrides = this.settings.rowOverrides || {}
      for (let k = 1; k < this.rows; k++) {
        arr[k] = arr[k - 1] + (overrides[k - 1] ?? this.settings.rowOffset)
      }
      return arr
    },

    nonRootIndices() {
      const out = []
      for (let i = this.rows - 1; i >= 1; i--) out.push(i)
      return out
    }
  },

  watch: {
    canvasEl: {
      immediate: false,
      handler(el) {
        this._observer?.disconnect()
        if (el) {
          this._observer = new ResizeObserver(() => this.recompute())
          this._observer.observe(el)
        }
        this.recompute()
      }
    },
    'settings.padScale'() {
      this.recompute()
    }
  },

  mounted() {
    if (this.canvasEl) {
      this._observer = new ResizeObserver(() => this.recompute())
      this._observer.observe(this.canvasEl)
    }
    this._onResize = () => this.recompute()
    window.addEventListener('resize', this._onResize)
    this.recompute()
  },

  beforeUnmount() {
    this._observer?.disconnect()
    window.removeEventListener('resize', this._onResize)
  },

  methods: {
    emitPatch(patch) {
      this.$emit('update', { ...this.settings, ...patch, preset: 'custom' })
    },

    hasOverride(gapIdx) {
      return this.settings.rowOverrides?.[gapIdx] != null
    },

    effectiveOffset(gapIdx) {
      return this.settings.rowOverrides?.[gapIdx] ?? this.settings.rowOffset
    },

    setOverride(gapIdx, value) {
      this.emitPatch({ rowOverrides: { ...(this.settings.rowOverrides || {}), [gapIdx]: value } })
    },

    clearOverride(gapIdx) {
      const next = { ...(this.settings.rowOverrides || {}) }
      delete next[gapIdx]
      this.emitPatch({ rowOverrides: next })
    },

    noteFor(i) {
      return noteNameWithOctave(this.settings.rootNote + this.cumulative[i])
    },

    onPreset(key) {
      const p = PRESETS[key]
      if (!p) return
      this.$emit('update', {
        ...this.settings,
        preset: key,
        rowOffset: p.rowOffset,
        colOffset: p.colOffset,
        rowOverrides: { ...(p.rowOverrides || {}) }
      })
    },

    recompute() {
      if (!this.canvasEl) {
        this.rows = 0
        this.rowPositions = []
        return
      }
      const padScale = this.settings.padScale || 1.0
      const { rows } = calcGrid(padScale, this.canvasEl)
      const rect = this.canvasEl.getBoundingClientRect()
      const padH = (rect.height - (rows + 1) * GRID_GAP) / rows
      const positions = []
      for (let i = 0; i < rows; i++) {
        const kFromTop = rows - 1 - i
        positions[i] = {
          top: rect.top + GRID_GAP + kFromTop * (padH + GRID_GAP),
          height: padH
        }
      }
      this.rows = rows
      this.rowPositions = positions
    },

    rowStyle(i) {
      const p = this.rowPositions[i]
      if (!p) return { display: 'none' }
      return { top: p.top + 'px', height: p.height + 'px' }
    }
  }
}
</script>

<style lang="sass">
.tuning-backdrop
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.85)
  z-index: var(--z-tuning)
  display: flex

.tuning-overrides
  position: relative
  width: min(240px, 25vw)
  flex-shrink: 0

.tuning-row-overlay
  position: absolute
  left: var(--space-1)
  right: var(--space-1)
  display: flex
  align-items: center

  .tuning-row
    flex: 1
    padding: var(--space-1) var(--space-2)
    gap: var(--space-1)

.tuning-options
  flex: 1
  min-width: 0
  display: flex
  align-items: center
  justify-content: center

.tuning-center
  width: min(280px, 100%)
  background: var(--color-surface)
  border: var(--border-hairline) solid var(--color-border-strong)
  border-radius: var(--radius-xl)
  padding: var(--space-4)
  display: flex
  flex-direction: column
  gap: var(--space-4)

.tuning-root
  font-size: var(--text-display)
  font-weight: 600
  color: var(--color-accent)
  padding: var(--space-3) 0
  background: var(--color-bg)
  border-radius: var(--radius-lg)
  font-variant-numeric: tabular-nums
  text-align: center

.tuning-globals
  display: flex
  gap: var(--space-2)

.tuning-global
  flex: 1
  display: flex
  align-items: center
  justify-content: space-between
  background: var(--color-bg)
  border-radius: var(--radius-lg)
  padding: var(--space-2) var(--space-3)

  .label
    font-size: var(--text-sm)
    color: var(--color-text-muted)
    text-transform: uppercase
    letter-spacing: 1px

  .value
    font-size: var(--text-xl)
    font-variant-numeric: tabular-nums
    min-width: 32px

.tuning-presets
  display: flex
  flex-wrap: wrap
  gap: var(--space-2)
  justify-content: center

  button
    background: var(--color-surface-3)
    color: var(--color-text)
    border: var(--border-hairline) solid var(--color-border-strong)
    border-radius: var(--radius-pill)
    padding: var(--space-2) var(--space-3)
    font-size: var(--text-sm)
    cursor: pointer

    &:hover
      background: var(--color-surface-hover)
    &.active
      background: var(--color-accent)
      color: var(--color-accent-text)
      border-color: var(--color-accent)
</style>
