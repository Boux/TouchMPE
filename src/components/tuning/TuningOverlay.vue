<template>
  <div class="tuning-overlay" @pointerdown.self="$emit('close')">
    <div class="tuning-modal" @pointerdown.stop>
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
.tuning-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.55)
  z-index: 95
  display: flex
  align-items: center
  justify-content: center
  padding: 24px

.tuning-modal
  width: min(360px, 100%)
  max-height: 90vh
  overflow-y: auto
  background: #222
  border: 1px solid #444
  border-radius: 12px
  padding: 20px
  display: flex
  flex-direction: column
  gap: 16px

.tuning-root
  font-size: 36px
  font-weight: 600
  color: var(--accent)
  padding: 14px 0
  background: #1a1a1a
  border-radius: 8px
  font-variant-numeric: tabular-nums

.tuning-globals
  display: flex
  gap: 10px

.tuning-global
  flex: 1
  display: flex
  align-items: center
  justify-content: space-between
  background: #1a1a1a
  border-radius: 8px
  padding: 10px 14px

  .label
    font-size: 12px
    color: #888
    text-transform: uppercase
    letter-spacing: 1px

  .value
    font-size: 18px
    color: #ccc
    font-variant-numeric: tabular-nums
    min-width: 32px

.tuning-rows
  display: flex
  flex-direction: column
  gap: 3px

.tuning-row
  display: flex
  align-items: center
  background: #2a2a2a
  border-radius: 6px
  padding: 8px 12px
  min-height: 40px
  gap: 8px

  .note
    flex: 1
    font-size: 14px
    color: #ccc
    font-variant-numeric: tabular-nums

  .delta
    font-size: 16px
    color: #888
    font-variant-numeric: tabular-nums
    min-width: 36px
    padding: 4px 8px
    border-radius: 4px

    &.overridden
      color: var(--accent)
      background: rgba(0, 0, 0, 0.3)

  .reset
    background: none
    border: none
    color: #888
    font-size: 16px
    cursor: pointer
    padding: 4px 6px
    line-height: 1

    &:hover
      color: #ccc

  &.root
    background: #1a1a1a

    .note
      color: var(--accent)

    .root-label
      font-size: 11px
      color: #666
      text-transform: uppercase
      letter-spacing: 1px

.tuning-presets
  display: flex
  flex-wrap: wrap
  gap: 6px

  button
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 999px
    padding: 6px 14px
    font-size: 12px
    cursor: pointer

    &:hover
      background: #3a3a3a

    &.active
      background: var(--accent)
      color: #000
      border-color: var(--accent)
</style>
