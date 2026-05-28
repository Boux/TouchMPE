<template>
  <div class="modal-overlay tuning-overlay" @pointerdown.self="$emit('close')">
    <div class="modal tuning-modal" @pointerdown.stop>
      <DragNumber
        class="tuning-root"
        axis="x"
        :sensitivity="14"
        :min="0"
        :max="127"
        :model-value="settings.rootNote"
        @update:model-value="onRoot"
      >
        {{ rootLabel }}
      </DragNumber>

      <div class="tuning-globals">
        <div class="tuning-global">
          <span class="label">Row</span>
          <DragNumber class="value" :min="1" :max="12" :model-value="settings.rowOffset" @update:model-value="onRowOffset">
            {{ settings.rowOffset }}
          </DragNumber>
        </div>
        <div class="tuning-global">
          <span class="label">Col</span>
          <DragNumber class="value" :min="1" :max="12" :model-value="settings.colOffset" @update:model-value="onColOffset">
            {{ settings.colOffset }}
          </DragNumber>
        </div>
      </div>

      <div class="tuning-rows">
        <div v-for="i in nonRootIndices" :key="i" class="tuning-row">
          <span class="note">{{ noteFor(i) }}</span>
          <button v-if="hasOverride(i - 1)" class="reset" @click="clearOverride(i - 1)" aria-label="Reset row">↺</button>
          <DragNumber
            :class="['delta', { overridden: hasOverride(i - 1) }]"
            :min="-12"
            :max="24"
            :model-value="effectiveOffset(i - 1)"
            @update:model-value="(v) => setOverride(i - 1, v)"
          >
            {{ formatOffset(effectiveOffset(i - 1)) }}
          </DragNumber>
        </div>
        <div class="tuning-row root">
          <span class="note">{{ rootLabel }}</span>
          <span class="root-label">root</span>
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
</template>

<script>
import DragNumber from './DragNumber.vue'
import { PRESETS } from '../../layout/KeyboardLayout.js'
import { noteNameWithOctave } from '../../layout/NoteUtils.js'

export default {
  name: 'TuningOverlay',

  components: { DragNumber },

  props: {
    settings: { type: Object, required: true },
    rows: { type: Number, required: true }
  },

  emits: ['update', 'close'],

  computed: {
    presets() { return PRESETS },

    rootLabel() {
      return noteNameWithOctave(this.settings.rootNote)
    },

    cumulative() {
      const arr = new Array(this.rows)
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

  methods: {
    emitPatch(patch) {
      this.$emit('update', { ...this.settings, ...patch, preset: 'custom' })
    },

    onRoot(v) { this.emitPatch({ rootNote: v }) },
    onRowOffset(v) { this.emitPatch({ rowOffset: v }) },
    onColOffset(v) { this.emitPatch({ colOffset: v }) },

    hasOverride(gapIdx) {
      const o = this.settings.rowOverrides
      return o != null && o[gapIdx] != null
    },

    effectiveOffset(gapIdx) {
      return this.settings.rowOverrides?.[gapIdx] ?? this.settings.rowOffset
    },

    setOverride(gapIdx, value) {
      const next = { ...(this.settings.rowOverrides || {}), [gapIdx]: value }
      this.emitPatch({ rowOverrides: next })
    },

    clearOverride(gapIdx) {
      const next = { ...(this.settings.rowOverrides || {}) }
      delete next[gapIdx]
      this.emitPatch({ rowOverrides: next })
    },

    noteFor(i) {
      return noteNameWithOctave(this.settings.rootNote + this.cumulative[i])
    },

    formatOffset(v) {
      return v >= 0 ? `+${v}` : `${v}`
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
    }
  }
}
</script>

<style lang="sass">
.tuning-modal
  width: min(360px, 100%)
  max-height: 90vh
  overflow-y: auto
  padding: var(--space-4)
  gap: var(--space-4)
  z-index: var(--z-tuning)

.tuning-root
  font-size: var(--text-display)
  font-weight: 600
  color: var(--color-accent)
  padding: var(--space-3) 0
  background: var(--color-bg)
  border-radius: var(--radius-lg)
  font-variant-numeric: tabular-nums

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

.tuning-rows
  display: flex
  flex-direction: column
  gap: var(--space-1)

.tuning-row
  display: flex
  align-items: center
  background: var(--color-surface-2)
  border-radius: var(--radius-md)
  padding: var(--space-2) var(--space-3)
  min-height: 40px
  gap: var(--space-2)

  .note
    flex: 1
    font-size: var(--text-md)
    font-variant-numeric: tabular-nums

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

  .reset
    background: none
    border: none
    color: var(--color-text-muted)
    font-size: var(--text-lg)
    cursor: pointer
    padding: var(--space-1) var(--space-2)
    line-height: 1

    &:hover
      color: var(--color-text)

  &.root
    background: var(--color-bg)

    .note
      color: var(--color-accent)
    .root-label
      font-size: var(--text-xs)
      color: var(--color-text-faint)
      text-transform: uppercase
      letter-spacing: 1px

.tuning-presets
  display: flex
  flex-wrap: wrap
  gap: var(--space-2)

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
