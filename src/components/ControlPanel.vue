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
        <svg viewBox="0 0 20 20"><path d="M3 3h4v4H3zM3 13h4v4H3zM13 3h4v4h-4zM13 13h4v4h-4z" fill="currentColor"/><path d="M10 1v18M1 10h18" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>

    <canvas ref="gridCanvas" class="grid-canvas"></canvas>

    <!-- Popup anchor (positioned over canvas for Floating UI) -->
    <div ref="popupAnchor" class="popup-anchor"></div>

    <!-- Add control popup -->
    <div v-if="popup" ref="addPopup" class="floating-popup"
      @pointerdown="startPopupDrag($event, 'addPopup')">
      <div class="add-controls-label">Add Control</div>
      <div class="add-controls-row">
        <button @click="placeControl('knob')">Knob</button>
        <button @click="placeControl('fader')">Fader</button>
        <button @click="placeControl('button')">Button</button>
        <button @click="placeControl('toggle')">Toggle</button>
        <button @click="placeControl('xypad')">XY</button>
      </div>
    </div>

    <!-- Control config popup -->
    <div v-if="selectedControl" ref="configPopup" class="floating-popup"
      @pointerdown="startPopupDrag($event, 'configPopup')">
      <label>
        Label
        <input type="text" v-model="selectedControl.label" @input="saveConfig; markDirty()" />
      </label>
      <label>
        CC Number
        <input type="number" v-model.number="selectedControl.cc" min="0" max="127" @input="saveConfig; markDirty()" />
      </label>
      <label v-if="selectedControl.type === 'xypad'">
        CC Y-Axis
        <input type="number" v-model.number="selectedControl.cc2" min="0" max="127" @input="saveConfig; markDirty()" />
      </label>
      <button class="delete-config-btn" @click="deleteControl(selectedControl.id)">
        Delete Control
      </button>
    </div>
  </div>
</template>

<script>
import { computePosition, autoPlacement, shift } from '@floating-ui/dom'
import { generateId, saveControlConfig } from '../store/controlConfig.js'
import ControlGridRenderer from '../engine/ControlGridRenderer.js'
import ControlGridInput from '../engine/ControlGridInput.js'

export default {
  name: 'ControlPanel',

  props: {
    config: { type: Object, required: true },
    engine: { type: Object, default: null }
  },

  emits: ['update'],

  data() {
    return {
      popup: null,
      popupCell: null,
      selectedCtrl: null,
      dragStart: null,
      dragEnd: null,
      controlValues: {},
      xyValues: {},
      layoutMode: false,
      locked: false,
      dragging: false,
      panX: 0,
      panY: 0
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
    this.renderer = new ControlGridRenderer(this.$refs.gridCanvas)
    this.input = new ControlGridInput(this.$refs.gridCanvas, {
      onValueChange: (ctrl, val, valY) => {
        this.controlValues[ctrl.id] = val
        if (valY !== undefined) this.xyValues[ctrl.id] = valY
        this.sendValue(ctrl)
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
      getValue: (id) => this.controlValues[id] ?? 0
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
    locked() {
      if (this.input) this.input.locked = this.locked
    },
    selectedCtrl() {
      if (this.input) this.input.selectedCtrl = this.selectedCtrl
      this.markDirty()
    }
  },

  methods: {
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
          controlValues: this.controlValues,
          xyValues: this.xyValues,
          selectedCtrl: this.selectedCtrl,
          dragStart: this.dragStart,
          dragEnd: this.dragEnd,
          occupiedSet: this.occupiedSet
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
        used.add(ctrl.cc)
        if (ctrl.cc2 != null) used.add(ctrl.cc2)
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
      const ccDefaults = { knob: 1, fader: 7, button: 64, toggle: 64, xypad: 1 }
      const ctrl = {
        id: generateId(),
        type,
        label: '',
        cc: this.nextAvailableCC(ccDefaults[type]),
        col: cell.col,
        row: cell.row,
        colSpan: 1,
        rowSpan: 1
      }
      if (type === 'xypad') ctrl.cc2 = this.nextAvailableCC(2, ctrl.cc)
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

    sendValue(ctrl) {
      if (!this.engine) return
      this.engine.sendCC(ctrl.cc, Math.round(this.controlValues[ctrl.id] ?? 0))
      if (ctrl.type === 'xypad' && ctrl.cc2 != null) {
        this.engine.sendCC(ctrl.cc2, Math.round(this.xyValues[ctrl.id] ?? 0))
      }
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
  background: #1a1a1a
  display: flex
  flex-direction: column
  flex-shrink: 0
  position: relative
  overflow: hidden

  &.dock-left
    border-right: 1px solid #333
  &.dock-right
    border-left: 1px solid #333
  &.dock-top
    border-bottom: 1px solid #333
  &.dock-bottom
    border-top: 1px solid #333

.panel-toolbar
  display: flex
  align-items: center
  gap: 6px
  padding: 4px 6px
  background: #222
  border-bottom: 1px solid #333
  flex-shrink: 0

.panel-toolbar-spacer
  flex: 1

.panel-toolbar-slider
  display: flex
  align-items: center
  gap: 4px
  flex: 1
  min-width: 0

  input[type="range"]
    flex: 1
    min-width: 40px
    accent-color: #ff8800
    height: 24px

.layout-toggle
  width: 28px
  height: 28px
  padding: 4px
  background: #333
  border: 1px solid #444
  border-radius: 4px
  color: #888
  cursor: pointer
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  &:hover
    background: #444
    color: #ccc

  &.active
    background: #ff8800
    color: #000
    border-color: #ff8800

  svg
    width: 16px
    height: 16px

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
  background: #222
  border: 1px solid #444
  border-radius: 8px
  padding: 16px
  display: flex
  flex-direction: column
  gap: 12px
  min-width: 240px
  max-width: 300px

  label
    display: flex
    justify-content: space-between
    align-items: center
    font-size: 14px
    color: #aaa

  input[type="text"], input[type="number"]
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 6px
    padding: 8px 10px
    font-size: 16px
    min-height: 40px
    width: 100px

  button
    background: #333
    color: #ccc
    border: 1px solid #444
    border-radius: 6px
    padding: 10px
    font-size: 14px
    cursor: pointer
    min-height: 40px

    &:hover
      background: #444

  .delete-config-btn
    color: #f66
    border-color: #633

    &:hover
      background: #622

.add-controls-label
  font-size: 13px
  color: #888
  text-transform: uppercase
  letter-spacing: 1px

.add-controls-row
  display: flex
  gap: 6px
  flex-wrap: wrap

  button
    flex: 1
    min-width: 60px
    text-align: center

// Layout mode
.layout-overlay
  position: absolute
  inset: 0
  z-index: 30
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
  background: rgba(255, 136, 0, 0.12)
  backdrop-filter: blur(4px)
  border: 3px dashed #ff8800
  cursor: grab
  display: flex
  align-items: center
  justify-content: center

  .is-dragging &
    cursor: grabbing
    background: rgba(255, 136, 0, 0.25)

.layout-overlay-text
  font-size: 16px
  font-weight: 600
  color: #ff8800
  text-transform: uppercase
  letter-spacing: 2px
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6)
  display: flex
  flex-direction: column
  align-items: center
  gap: 12px
  pointer-events: none

.layout-done-btn
  pointer-events: auto
  background: #ff8800
  color: #000
  border: none
  border-radius: 6px
  padding: 8px 24px
  font-size: 14px
  font-weight: 600
  cursor: pointer

.layout-resize-edge
  background: #2a2a2a
  border: 2px dotted #ff8800
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  &::after
    content: ''
    border-radius: 2px
    background: #ff8800
    opacity: 0.6

  .dock-right &, .dock-left &
    width: 18px
    cursor: ew-resize
    flex-direction: column

    &::after
      width: 3px
      height: 32px

  .dock-top &, .dock-bottom &
    height: 18px
    cursor: ns-resize

    &::after
      height: 3px
      width: 32px
</style>
