<template>
  <div
    class="control-panel"
    :class="['dock-' + config.dockSide, { 'is-layout-mode': layoutMode, 'is-dragging': dragging }]"
    :style="panelStyle"
  >
    <!-- Layout mode overlay -->
    <div v-if="layoutMode" class="layout-overlay">
      <div class="layout-drag-area"
        @pointerdown.prevent="startDragSnap"
        @touchstart.prevent>
        <div class="layout-overlay-text">
          Drag to snap
          <button class="layout-done-btn" @pointerdown.stop @touchstart.stop @click.stop="layoutMode = false">Done</button>
        </div>
      </div>
      <div class="layout-resize-edge"
        @pointerdown.prevent="startEdgeResize"
        @touchstart.prevent></div>
    </div>

    <div class="panel-toolbar">
      <div v-if="!locked" class="panel-toolbar-slider">
        <input type="range" :value="config.cellSize" min="30" max="120" step="5"
          @input="updateCellSize(+$event.target.value)" title="Zoom" />
      </div>
      <div v-if="locked" class="panel-toolbar-spacer"></div>
      <button
        class="layout-toggle"
        :class="{ active: locked }"
        @click.stop="toggleLock"
        title="Lock panel"
      >
        <svg v-if="locked" viewBox="0 0 20 20"><rect x="3" y="9" width="14" height="9" rx="2" fill="currentColor"/><path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <svg v-else viewBox="0 0 20 20"><rect x="3" y="9" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button
        v-if="!locked"
        class="layout-toggle"
        :class="{ active: layoutMode }"
        @click.stop="layoutMode = !layoutMode"
        title="Move/resize panel"
      >
        <svg viewBox="0 0 20 20"><path d="M10 2l3 3H7l3-3zM10 18l-3-3h6l-3 3zM2 10l3-3v6l-3-3zM18 10l-3 3V7l3 3z" fill="currentColor"/></svg>
      </button>
    </div>

    <canvas ref="gridCanvas" class="grid-canvas"></canvas>

    <!-- Popup anchor (positioned over canvas for Floating UI) -->
    <div ref="popupAnchor" class="popup-anchor"></div>

    <!-- Add control popup -->
    <div v-if="popup" ref="addPopup" class="floating-popup"
      @pointerdown="startPopupDrag($event, 'addPopup')">
      <div class="add-controls-label">Add Control</div>
      <div class="add-controls-grid">
        <button v-for="t in controlTypes" :key="t.type" @click="placeControl(t.type)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="t.svg"></svg>
          <span>{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- Control config popup -->
    <div v-if="selectedControl" ref="configPopup" class="floating-popup"
      :class="{ 'is-dimmed': dragStart && dragEnd }"
      @pointerdown="startPopupDrag($event, 'configPopup')">
      <template v-if="!changeMode">
        <label>
          Label
          <input type="text" v-model="selectedControl.label" @input="saveConfig; markDirty()" />
        </label>
        <label v-for="(ccNum, key) in selectedControl.cc_num" :key="key">
          {{ ccLabel(selectedControl, key) }}
          <input type="number" :value="ccNum" min="0" max="127"
            @input="selectedControl.cc_num[key] = +$event.target.value; saveConfig(); markDirty()" />
        </label>
        <div class="config-actions">
          <button class="btn" @click="changeMode = true">Change</button>
          <button class="btn btn-danger" @click="deleteControl(selectedControl.id)">Delete</button>
        </div>
      </template>
      <template v-else>
        <div class="add-controls-label">Change Type</div>
        <div class="add-controls-grid">
          <button v-for="t in controlTypes" :key="t.type"
            :class="{ 'is-current': t.type === selectedControl.type }"
            @click="changeType(t.type)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="t.svg"></svg>
            <span>{{ t.label }}</span>
          </button>
        </div>
        <button class="btn" @click="changeMode = false">Cancel</button>
      </template>
    </div>
  </div>
</template>

<script>
import { computePosition, autoPlacement, shift } from '@floating-ui/dom'
import { generateId, saveControlConfig } from '../store/controlConfig.js'
import { createControl, Control } from '../engine/controls/index.js'
import ControlGridRenderer from '../engine/ControlGridRenderer.js'
import ControlGridInput from '../engine/ControlGridInput.js'

export default {
  name: 'ControlPanel',

  props: {
    config: { type: Object, required: true },
    engine: { type: Object, default: null },
    accentColor: { type: String, default: '#ff8800' }
  },

  emits: ['update'],

  data() {
    return {
      popup: null,
      popupCell: null,
      selectedCtrl: null,
      dragStart: null,
      dragEnd: null,
      layoutMode: false,
      locked: false,
      dragging: false,
      changeMode: false,
      panX: 0,
      panY: 0,
      controlTypes: [
        { type: 'knob', label: 'Knob', svg: '<circle cx="12" cy="12" r="7"/><line x1="12" y1="12" x2="8" y2="8" stroke-linecap="round"/>' },
        { type: 'fader', label: 'Fader', svg: '<line x1="12" y1="4" x2="12" y2="20" stroke-linecap="round"/><rect x="6" y="13" width="12" height="4" rx="1" fill="currentColor" stroke="none"/>' },
        { type: 'button', label: 'Button', svg: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>' },
        { type: 'toggle', label: 'Toggle', svg: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.5" fill="currentColor" stroke="none"/>' },
        { type: 'xypad', label: 'XY', svg: '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="9" x2="20" y2="9" stroke-dasharray="1 2" opacity="0.5"/><line x1="15" y1="4" x2="15" y2="20" stroke-dasharray="1 2" opacity="0.5"/><circle cx="15" cy="9" r="2" fill="currentColor" stroke="none"/>' }
      ]
    }
  },

  computed: {
    isHorizontal() {
      const s = this.config.dockSide
      return s === 'left' || s === 'right'
    },

    panelStyle() {
      const pct = Math.max(10, Math.min(80, this.config.panelSize)) + '%'
      return this.isHorizontal ? { width: pct } : { height: pct }
    },

    occupiedSet() {
      const s = new Set()
      for (const ctrl of this.config.controls) {
        for (let r = ctrl.row; r < ctrl.row + ctrl.rowSpan; r++) {
          for (let c = ctrl.col; c < ctrl.col + ctrl.colSpan; c++) {
            s.add(c + ',' + r)
          }
        }
      }
      return s
    },

    selectedControl() {
      if (!this.selectedCtrl) return null
      return this.config.controls.find(c => c.id === this.selectedCtrl) || null
    }
  },

  mounted() {
    this._hydrateControls()
    this.renderer = new ControlGridRenderer(this.$refs.gridCanvas)
    this.input = new ControlGridInput(this.$refs.gridCanvas, {
      onValueChange: (ctrl, val) => {
        const ccUpdates = ctrl.setValues(val)
        if (this.engine) {
          for (const [ccNum, v] of Object.entries(ccUpdates)) {
            this.engine.sendCC(+ccNum, Math.round(v))
          }
        }
        this.markDirty()
      },
      onContext: (cell, e) => {
        if (!this.occupiedSet.has(cell.col + ',' + cell.row)) {
          this.popupCell = cell
          this.popup = true
          this.selectedCtrl = null
          this.positionAnchorAtCell(cell)
          this.$nextTick(() => this.positionFloating('addPopup'))
        }
      },
      onSelect: (id) => {
        this.selectedCtrl = id
        this.repositionConfigPopup()
      },
      onDeselect: () => {
        this.selectedCtrl = null
      },
      onDragResize: (from, to) => {
        this.dragStart = from
        this.dragEnd = to
        this.markDirty()
      },
      onDragResizeEnd: (from, to) => {
        this.finishDragResize(from, to)
        this.dragStart = null
        this.dragEnd = null
        this.markDirty()
      },
      onPanChange: (px, py) => {
        this.panX = px
        this.panY = py
        this.markDirty()
      },
      getValue: (id, key = 'value') => {
        const ctrl = this.config.controls.find(c => c.id === id)
        return ctrl ? (ctrl.values[key] ?? 0) : 0
      }
    })
    this.input.cellSize = this.config.cellSize || 60
    this.input.controls = this.config.controls
    this.input.locked = this.locked

    this._onDocClick = (e) => {
      if (this.popup && this.$refs.addPopup && !this.$refs.addPopup.contains(e.target)) {
        this.popup = null
      }
      if (this.selectedCtrl) {
        const inPopup = this.$refs.configPopup && this.$refs.configPopup.contains(e.target)
        const inCanvas = this.$refs.gridCanvas && this.$refs.gridCanvas.contains(e.target)
        if (!inPopup && !inCanvas) {
          this.selectedCtrl = null
          this.markDirty()
        }
      }
    }
    document.addEventListener('pointerdown', this._onDocClick, true)

    this._startRenderLoop()
  },

  beforeUnmount() {
    if (this.renderer) this.renderer.destroy()
    if (this.input) this.input.destroy()
    if (this._animId) cancelAnimationFrame(this._animId)
    document.removeEventListener('pointerdown', this._onDocClick, true)
  },

  watch: {
    'config.cellSize'() {
      if (this.input) this.input.cellSize = this.config.cellSize || 60
      this.markDirty()
    },
    'config.controls'() {
      if (this.input) this.input.controls = this.config.controls
      this.markDirty()
    },
    accentColor() {
      this.markDirty()
    },
    locked() {
      if (this.input) this.input.locked = this.locked
    },
    selectedCtrl() {
      if (this.input) this.input.selectedCtrl = this.selectedCtrl
      this.changeMode = false
      this.markDirty()
    }
  },

  methods: {
    ccLabel(ctrl, key) {
      const count = Object.keys(ctrl.cc_num).length
      if (count === 1) return 'CC Number'
      const labels = { x: 'CC X-Axis', y: 'CC Y-Axis', value: 'CC Number' }
      return labels[key] || ('CC ' + key)
    },

    _hydrateControls() {
      this.config.controls = this.config.controls.map(c =>
        c instanceof Control ? c : createControl(c)
      )
    },

    markDirty() {
      if (this.renderer) this.renderer.dirty = true
    },

    _startRenderLoop() {
      const loop = () => {
        this.renderer.draw({
          cellSize: this.config.cellSize || 60,
          gap: 2,
          panX: this.panX,
          panY: this.panY,
          controls: this.config.controls,
          selectedCtrl: this.selectedCtrl,
          dragStart: this.dragStart,
          dragEnd: this.dragEnd,
          occupiedSet: this.occupiedSet,
          accentColor: this.accentColor
        })
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },

    // --- Popup positioning ---
    positionAnchorAtCell(cell) {
      const canvas = this.$refs.gridCanvas
      const anchor = this.$refs.popupAnchor
      if (!canvas || !anchor) return
      const rect = canvas.getBoundingClientRect()
      const step = (this.config.cellSize || 60) + 2
      anchor.style.left = (rect.left + cell.col * step - this.panX) + 'px'
      anchor.style.top = (rect.top + cell.row * step - this.panY) + 'px'
      anchor.style.width = (step - 2) + 'px'
      anchor.style.height = (step - 2) + 'px'
    },

    positionAnchorAtCtrl(ctrl) {
      const canvas = this.$refs.gridCanvas
      const anchor = this.$refs.popupAnchor
      if (!canvas || !anchor || !ctrl) return
      const rect = canvas.getBoundingClientRect()
      const step = (this.config.cellSize || 60) + 2
      anchor.style.left = (rect.left + ctrl.col * step - this.panX) + 'px'
      anchor.style.top = (rect.top + ctrl.row * step - this.panY) + 'px'
      anchor.style.width = (ctrl.colSpan * step - 2) + 'px'
      anchor.style.height = (ctrl.rowSpan * step - 2) + 'px'
    },

    positionFloating(refName) {
      this.$nextTick(() => {
        const floating = this.$refs[refName]
        const anchor = this.$refs.popupAnchor
        if (!floating || !anchor) return
        computePosition(anchor, floating, {
          middleware: [autoPlacement(), shift({ padding: 8 })]
        }).then(({ x, y }) => {
          floating.style.left = x + 'px'
          floating.style.top = y + 'px'
        })
      })
    },

    repositionConfigPopup() {
      if (!this.selectedCtrl) return
      const ctrl = this.config.controls.find(c => c.id === this.selectedCtrl)
      if (ctrl) this.positionAnchorAtCtrl(ctrl)
      this.$nextTick(() => this.positionFloating('configPopup'))
    },

    startPopupDrag(e, refName) {
      if (e.target.closest('input, button, .slider-group')) return
      const el = this.$refs[refName]
      if (!el) return
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      const startX = e.clientX
      const startY = e.clientY
      const startLeft = parseInt(el.style.left) || 0
      const startTop = parseInt(el.style.top) || 0
      const onMove = (e) => {
        el.style.left = (startLeft + e.clientX - startX) + 'px'
        el.style.top = (startTop + e.clientY - startY) + 'px'
      }
      const onUp = () => {
        el.releasePointerCapture(e.pointerId)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },

    // --- Control management ---
    nextAvailableCC(preferred, ...exclude) {
      const used = new Set(exclude)
      for (const ctrl of this.config.controls) {
        const nums = ctrl.cc_num || {}
        for (const v of Object.values(nums)) {
          if (v != null) used.add(v)
        }
      }
      if (!used.has(preferred)) return preferred
      for (let cc = 1; cc <= 127; cc++) {
        if (!used.has(cc)) return cc
      }
      return preferred
    },

    placeControl(type) {
      const cell = this.popupCell
      if (!cell || this.occupiedSet.has(cell.col + ',' + cell.row)) {
        this.popup = null
        return
      }
      const ctrl = createControl({
        id: generateId(),
        type,
        col: cell.col,
        row: cell.row
      })
      // Assign next available CC numbers, excluding ones already picked
      const assigned = []
      for (const key of Object.keys(ctrl.cc_num)) {
        ctrl.cc_num[key] = this.nextAvailableCC(ctrl.cc_num[key], ...assigned)
        assigned.push(ctrl.cc_num[key])
      }
      this.config.controls.push(ctrl)
      this.saveConfig()
      this.popup = null
      this.selectedCtrl = ctrl.id
      this.repositionConfigPopup()
      this.markDirty()
    },

    deleteControl(id) {
      this.config.controls = this.config.controls.filter(c => c.id !== id)
      if (this.selectedCtrl === id) this.selectedCtrl = null
      this.saveConfig()
      this.markDirty()
    },

    changeType(newType) {
      const ctrl = this.selectedControl
      if (!ctrl) return
      if (ctrl.type === newType) {
        this.changeMode = false
        return
      }
      const oldCC = ctrl.cc_num.value ?? ctrl.cc_num.x ?? 1
      const data = {
        id: ctrl.id,
        type: newType,
        label: ctrl.label,
        col: ctrl.col,
        row: ctrl.row,
        colSpan: ctrl.colSpan,
        rowSpan: ctrl.rowSpan,
        channel: ctrl.channel
      }
      if (newType === 'xypad') {
        const yCC = this.nextAvailableCC(ctrl.cc_num.y ?? 2, oldCC)
        data.cc_num = { x: oldCC, y: yCC }
      } else {
        data.cc_num = { value: oldCC }
      }
      const newCtrl = createControl(data)
      const idx = this.config.controls.findIndex(c => c.id === ctrl.id)
      if (idx !== -1) this.config.controls.splice(idx, 1, newCtrl)
      this.changeMode = false
      this.saveConfig()
      this.markDirty()
      this.repositionConfigPopup()
    },

    finishDragResize(from, to) {
      const ctrl = this.config.controls.find(c => c.id === this.selectedCtrl)
      if (!ctrl) return
      const c1 = Math.min(from.col, to.col)
      const c2 = Math.max(from.col, to.col)
      const r1 = Math.min(from.row, to.row)
      const r2 = Math.max(from.row, to.row)
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const key = c + ',' + r
          if (this.occupiedSet.has(key)) {
            // Check it's not the selected control itself
            if (c < ctrl.col || c >= ctrl.col + ctrl.colSpan ||
                r < ctrl.row || r >= ctrl.row + ctrl.rowSpan) return
          }
        }
      }
      ctrl.col = c1
      ctrl.row = r1
      ctrl.colSpan = c2 - c1 + 1
      ctrl.rowSpan = r2 - r1 + 1
      this.saveConfig()
      this.repositionConfigPopup()
    },

    updateCellSize(val) {
      this.config.cellSize = val
      this.saveConfig()
    },

    toggleLock() {
      this.locked = !this.locked
      if (this.locked) {
        this.layoutMode = false
        this.selectedCtrl = null
      }
    },

    saveConfig() {
      this.$emit('update', this.config)
      saveControlConfig(this.config)
    },


    // --- Layout mode ---
    startDragSnap(e) {
      if (e.target.closest('button')) return
      this.dragging = true
      const el = e.target.closest('.layout-drag-area')
      if (el) el.setPointerCapture(e.pointerId)
      const onMove = (e) => {
        const x = e.clientX
        const y = e.clientY
        const w = window.innerWidth
        const h = window.innerHeight
        const dists = { left: x, right: w - x, top: y, bottom: h - y }
        const closest = Object.keys(dists).reduce((a, b) => dists[a] < dists[b] ? a : b)
        if (this.config.dockSide !== closest) {
          this.config.dockSide = closest
        }
      }
      const onUp = () => {
        this.dragging = false
        this.saveConfig()
        el?.removeEventListener('pointermove', onMove)
        el?.removeEventListener('pointerup', onUp)
      }
      el?.addEventListener('pointermove', onMove)
      el?.addEventListener('pointerup', onUp)
    },

    startEdgeResize(e) {
      const parent = this.$el.parentElement
      if (!parent) return
      const edge = e.target
      edge.setPointerCapture(e.pointerId)
      const startX = e.clientX
      const startY = e.clientY
      const startPct = this.config.panelSize
      const parentRect = parent.getBoundingClientRect()
      const onMove = (e) => {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        let deltaPct
        const side = this.config.dockSide
        if (side === 'right') deltaPct = -dx / parentRect.width * 100
        else if (side === 'left') deltaPct = dx / parentRect.width * 100
        else if (side === 'bottom') deltaPct = -dy / parentRect.height * 100
        else deltaPct = dy / parentRect.height * 100
        this.config.panelSize = Math.max(10, Math.min(80, startPct + deltaPct))
      }
      const onUp = () => {
        this.saveConfig()
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
.control-panel
  background: var(--color-bg)
  display: flex
  flex-direction: column
  flex-shrink: 0
  position: relative
  overflow: hidden

  &.dock-left
    border-right: var(--border-hairline) solid var(--color-border)
  &.dock-right
    border-left: var(--border-hairline) solid var(--color-border)
  &.dock-top
    border-bottom: var(--border-hairline) solid var(--color-border)
  &.dock-bottom
    border-top: var(--border-hairline) solid var(--color-border)

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
  cursor: pointer
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  svg
    width: 16px
    height: 16px

  &:hover
    background: var(--color-border-strong)
    color: var(--color-text)

  &.active
    background: var(--color-accent)
    color: var(--color-accent-text)
    border-color: var(--color-accent)

.grid-canvas
  flex: 1
  width: 100%
  min-height: 0
  display: block

.popup-anchor
  position: fixed
  width: 1px
  height: 1px
  pointer-events: none

.floating-popup
  position: fixed
  left: 0
  top: 0
  z-index: 201
  touch-action: none
  background: var(--color-surface)
  border: var(--border-hairline) solid var(--color-border-strong)
  border-radius: var(--radius-lg)
  padding: var(--space-4)
  display: flex
  flex-direction: column
  gap: var(--space-3)
  min-width: 240px
  max-width: 300px
  transition: opacity var(--transition-fast)

  &.is-dimmed
    opacity: 0.5
    pointer-events: none

  label
    display: flex
    justify-content: space-between
    align-items: center
    font-size: var(--text-md)
    color: var(--color-text-secondary)

  input[type="text"], input[type="number"]
    width: 100px

  .config-actions
    display: flex
    gap: var(--space-2)

    .btn
      flex: 1

.add-controls-label
  font-size: var(--text-sm)
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 1px

.add-controls-grid
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: var(--space-2)

  button
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    gap: var(--space-2)
    padding: var(--space-3) var(--space-2)
    min-height: 64px
    color: var(--color-text)

    svg
      width: 24px
      height: 24px
      flex-shrink: 0

    &.is-current
      border-color: var(--color-accent)
      color: var(--color-accent)

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

  .is-dragging &
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
