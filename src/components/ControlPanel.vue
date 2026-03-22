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
        @click.stop="locked = !locked; if (locked) { layoutMode = false; selectedCtrl = null }"
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

    <div
      ref="grid"
      class="panel-grid"
      :class="{ selecting: selectedCtrl, locked: locked }"
      @pointerdown="onGridDown"
      @pointermove="onGridMove"
      @pointerup="onGridUp"
      @pointercancel="onGridUp"
      @contextmenu.prevent="onGridContext"
    >
      <div class="grid-inner" :style="gridInnerStyle">
        <!-- Empty cells -->
        <div
          v-for="cell in emptyCells"
          :key="'e-' + cell.col + '-' + cell.row"
          :ref="'cell-' + cell.col + '-' + cell.row"
          class="grid-cell"
          :class="{ highlight: isCellInDrag(cell.col, cell.row) }"
          :style="cellAbsStyle(cell, 1, 1)"
        ></div>

        <!-- Controls -->
        <div
          v-for="ctrl in config.controls"
          :key="ctrl.id"
          :ref="'ctrl-' + ctrl.id"
          class="grid-control"
          :class="[
            'type-' + ctrl.type,
            { 'is-active': activePointers[ctrl.id], 'is-selected': selectedCtrl === ctrl.id }
          ]"
          :style="cellAbsStyle(ctrl, ctrl.colSpan, ctrl.rowSpan)"
          @pointerdown.stop.prevent="onControlDown($event, ctrl)"
          @pointermove.prevent="onControlMove($event, ctrl)"
          @pointerup.prevent="onControlUp($event, ctrl)"
          @pointercancel.prevent="onControlUp($event, ctrl)"
          @contextmenu.stop.prevent="openConfig(ctrl)"
        >
        <div class="control-label">{{ ctrl.label || ccLabel(ctrl.cc) }}</div>
        <div class="control-value">{{ Math.round(controlValues[ctrl.id] ?? 0) }}</div>

        <svg v-if="ctrl.type === 'knob'" class="knob-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#444" stroke-width="6"
            stroke-dasharray="200" stroke-dashoffset="40"
            transform="rotate(130 50 50)" stroke-linecap="round" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#ff8800" stroke-width="6"
            :stroke-dasharray="knobArc(ctrl)" stroke-dashoffset="40"
            transform="rotate(130 50 50)" stroke-linecap="round" />
        </svg>

        <div v-if="ctrl.type === 'fader'" class="fader-track"
          :class="ctrl.colSpan > ctrl.rowSpan ? 'horizontal' : 'vertical'">
          <div class="fader-fill" :style="faderFillStyle(ctrl)"></div>
        </div>

        <div v-if="ctrl.type === 'xypad'" class="xypad-area">
          <div class="xypad-dot" :style="xyDotStyle(ctrl)"></div>
        </div>

        <div v-if="ctrl.type === 'button' || ctrl.type === 'toggle'" class="btn-indicator"
          :class="{ on: (controlValues[ctrl.id] ?? 0) > 0 }"></div>
      </div>
      </div>
    </div>

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
        <input type="text" v-model="selectedControl.label" @input="saveConfig" />
      </label>
      <label>
        CC Number
        <input type="number" v-model.number="selectedControl.cc" min="0" max="127" @input="saveConfig" />
      </label>
      <label v-if="selectedControl.type === 'xypad'">
        CC Y-Axis
        <input type="number" v-model.number="selectedControl.cc2" min="0" max="127" @input="saveConfig" />
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
      activePointers: {},
      layoutMode: false,
      locked: false,
      dragging: false
    }
  },

  mounted() {
    this._onDocClick = (e) => {
      if (this.popup && this.$refs.addPopup && !this.$refs.addPopup.contains(e.target)) {
        this.popup = null
      }
      // Deselect if clicking outside both the popup and the panel grid
      if (this.selectedCtrl) {
        const inPopup = this.$refs.configPopup && this.$refs.configPopup.contains(e.target)
        const inGrid = this.$refs.grid && this.$refs.grid.contains(e.target)
        if (!inPopup && !inGrid) {
          this.selectedCtrl = null
        }
      }
    }
    document.addEventListener('pointerdown', this._onDocClick, true)
  },

  beforeUnmount() {
    document.removeEventListener('pointerdown', this._onDocClick, true)
  },

  computed: {
    isHorizontal() {
      const s = this.config.dockSide
      return s === 'left' || s === 'right'
    },

    panelStyle() {
      const pct = Math.max(10, Math.min(80, this.config.panelSize)) + '%'
      return this.isHorizontal
        ? { width: pct }
        : { height: pct }
    },

    sz() { return this.config.cellSize || 60 },
    gap() { return 2 },

    gridBounds() {
      let minC = 0, minR = 0, maxC = 0, maxR = 0
      for (const ctrl of this.config.controls) {
        minC = Math.min(minC, ctrl.col)
        minR = Math.min(minR, ctrl.row)
        maxC = Math.max(maxC, ctrl.col + ctrl.colSpan)
        maxR = Math.max(maxR, ctrl.row + ctrl.rowSpan)
      }
      const pad = 5
      return {
        minCol: minC - pad, minRow: minR - pad,
        maxCol: maxC + pad, maxRow: maxR + pad
      }
    },

    gridInnerStyle() {
      const b = this.gridBounds
      const step = this.sz + this.gap
      return {
        width: (b.maxCol - b.minCol) * step + 'px',
        height: (b.maxRow - b.minRow) * step + 'px'
      }
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

    emptyCells() {
      const b = this.gridBounds
      const cells = []
      for (let row = b.minRow; row < b.maxRow; row++) {
        for (let col = b.minCol; col < b.maxCol; col++) {
          if (!this.occupiedSet.has(col + ',' + row)) {
            cells.push({ col, row })
          }
        }
      }
      return cells
    },

    selectedControl() {
      if (!this.selectedCtrl) return null
      return this.config.controls.find(c => c.id === this.selectedCtrl) || null
    }
  },

  methods: {
    updateCellSize(val) {
      this.config.cellSize = val
      this.saveConfig()
    },

    cellFromEvent(e) {
      const grid = this.$refs.grid
      if (!grid) return null
      const b = this.gridBounds
      const step = this.sz + this.gap

      const x = e.clientX - grid.getBoundingClientRect().left + grid.scrollLeft
      const y = e.clientY - grid.getBoundingClientRect().top + grid.scrollTop
      const col = Math.floor(x / step) + b.minCol
      const row = Math.floor(y / step) + b.minRow
      return { col, row }
    },

    cellAbsStyle(item, colSpan, rowSpan) {
      const b = this.gridBounds
      const step = this.sz + this.gap
      return {
        position: 'absolute',
        left: (item.col - b.minCol) * step + 'px',
        top: (item.row - b.minRow) * step + 'px',
        width: colSpan * step - this.gap + 'px',
        height: rowSpan * step - this.gap + 'px'
      }
    },

    knobArc(ctrl) {
      const val = (this.controlValues[ctrl.id] ?? 0) / 127
      return (val * 200) + ' 200'
    },

    faderFillStyle(ctrl) {
      const val = (this.controlValues[ctrl.id] ?? 0) / 127 * 100
      return ctrl.colSpan > ctrl.rowSpan ? { width: val + '%' } : { height: val + '%' }
    },

    xyDotStyle(ctrl) {
      const x = (this.controlValues[ctrl.id] ?? 64) / 127 * 100
      const y = 100 - (this.xyValues[ctrl.id] ?? 64) / 127 * 100
      return { left: x + '%', top: y + '%' }
    },

    ccLabel(cc) { return 'CC' + (cc ?? 1) },

    isCellOccupied(col, row) { return this.occupiedSet.has(col + ',' + row) },

    isCellInDrag(col, row) {
      if (!this.selectedCtrl || !this.dragStart || !this.dragEnd) return false
      const c1 = Math.min(this.dragStart.col, this.dragEnd.col)
      const c2 = Math.max(this.dragStart.col, this.dragEnd.col)
      const r1 = Math.min(this.dragStart.row, this.dragEnd.row)
      const r2 = Math.max(this.dragStart.row, this.dragEnd.row)
      return col >= c1 && col <= c2 && row >= r1 && row <= r2
    },

    startPopupDrag(e, refName) {
      if (e.target.closest('input, button, .slider-group')) return
      const el = this.$refs[refName]
      if (!el) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startLeft = parseInt(el.style.left) || 0
      const startTop = parseInt(el.style.top) || 0
      const onMove = (e) => {
        el.style.left = (startLeft + e.clientX - startX) + 'px'
        el.style.top = (startTop + e.clientY - startY) + 'px'
      }
      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },

    repositionConfigPopup() {
      if (!this.selectedCtrl) return
      this.$nextTick(() => {
        const refArr = this.$refs['ctrl-' + this.selectedCtrl]
        const anchor = Array.isArray(refArr) ? refArr[0] : refArr
        if (anchor) this.positionFloating(anchor, 'configPopup')
      })
    },

    positionFloating(anchorEl, floatingRef) {
      this.$nextTick(() => {
        const floating = this.$refs[floatingRef]
        if (!floating || !anchorEl) return
        computePosition(anchorEl, floating, {
          middleware: [autoPlacement(), shift({ padding: 8 })]
        }).then(({ x, y }) => {
          floating.style.left = x + 'px'
          floating.style.top = y + 'px'
        })
      })
    },

    // --- Context menu (right click / long touch) ---
    onGridContext(e) {
      if (this.locked) return
      const cell = this.cellFromEvent(e)
      if (!cell) return
      if (!this.isCellOccupied(cell.col, cell.row)) {
        this.popupCell = cell
        this.popup = true
        this.selectedCtrl = null
        const refArr = this.$refs['cell-' + cell.col + '-' + cell.row]
        const anchor = Array.isArray(refArr) ? refArr[0] : refArr
        if (anchor) this.positionFloating(anchor, 'addPopup')
      }
    },


    // --- Grid pointer events ---
    onGridDown(e) {
      const cell = this.cellFromEvent(e)
      if (!cell) return

      if (this.selectedCtrl) {
        e.preventDefault()
        this._gridDownStart = { x: e.clientX, y: e.clientY, cell, dragging: false }
        this.$refs.grid.setPointerCapture(e.pointerId)
        return
      }
      // No selected ctrl: let the event through for native scrolling
    },

    onGridMove(e) {
      const s = this._gridDownStart
      if (!s || !this.selectedCtrl) return
      e.preventDefault()

      if (!s.dragging) {
        const dx = Math.abs(e.clientX - s.x)
        const dy = Math.abs(e.clientY - s.y)
        if (dx > 8 || dy > 8) {
          s.dragging = true
          this.dragStart = s.cell
          this.dragEnd = s.cell
        }
        return
      }

      const cell = this.cellFromEvent(e)
      if (cell) this.dragEnd = cell
    },

    onGridUp(e) {
      const s = this._gridDownStart
      this._gridDownStart = null

      if (this.selectedCtrl && s && s.dragging && this.dragStart && this.dragEnd) {
        this.resizeSelectedTo(this.dragStart, this.dragEnd)
      } else if (this.selectedCtrl && s && !s.dragging) {
        // Single tap → deselect
        this.deselectCtrl()
      }

      this.dragStart = null
      this.dragEnd = null
    },

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

    // --- Place control from popup ---
    placeControl(type) {
      const cell = this.popupCell
      if (!cell || this.isCellOccupied(cell.col, cell.row)) {
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
    },

    // --- Selected control actions ---
    moveSelectedTo(cell) {
      const ctrl = this.config.controls.find(c => c.id === this.selectedCtrl)
      if (!ctrl) return
      for (let r = cell.row; r < cell.row + ctrl.rowSpan; r++) {
        for (let c = cell.col; c < cell.col + ctrl.colSpan; c++) {
          if (this.isCellOccupiedByOther(c, r, ctrl.id)) return
        }
      }
      ctrl.col = cell.col
      ctrl.row = cell.row
      this.saveConfig()
      this.repositionConfigPopup()
    },

    resizeSelectedTo(from, to) {
      const ctrl = this.config.controls.find(c => c.id === this.selectedCtrl)
      if (!ctrl) return

      const c1 = Math.min(from.col, to.col)
      const c2 = Math.max(from.col, to.col)
      const r1 = Math.min(from.row, to.row)
      const r2 = Math.max(from.row, to.row)

      // Check no collision
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (this.isCellOccupiedByOther(c, r, ctrl.id)) return
        }
      }

      ctrl.col = c1
      ctrl.row = r1
      ctrl.colSpan = c2 - c1 + 1
      ctrl.rowSpan = r2 - r1 + 1
      this.saveConfig()
      this.repositionConfigPopup()
    },

    isCellOccupiedByOther(col, row, excludeId) {
      for (const ctrl of this.config.controls) {
        if (ctrl.id === excludeId) continue
        if (col >= ctrl.col && col < ctrl.col + ctrl.colSpan &&
            row >= ctrl.row && row < ctrl.row + ctrl.rowSpan) {
          return true
        }
      }
      return false
    },

    deselectCtrl() {
      this.selectedCtrl = null
      this.dragStart = null
      this.dragEnd = null
    },

    // --- Config ---
    openConfig(ctrl) {
      this.selectedCtrl = ctrl.id
      this.repositionConfigPopup()
    },

    deleteControl(id) {
      this.config.controls = this.config.controls.filter(c => c.id !== id)
      if (this.selectedCtrl === id) this.selectedCtrl = null
      this.saveConfig()
    },


    saveConfig() {
      this.$emit('update', this.config)
      saveControlConfig(this.config)
    },

    // --- Panel drag-to-snap ---
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
        if (el) el.releasePointerCapture(e.pointerId)
        el?.removeEventListener('pointermove', onMove)
        el?.removeEventListener('pointerup', onUp)
      }
      el?.addEventListener('pointermove', onMove)
      el?.addEventListener('pointerup', onUp)
    },

    // --- Panel inner edge resize (percentage) ---
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
    },

    // --- Control interaction (play mode) ---
    onControlDown(e, ctrl) {
      if (this.selectedCtrl) {
        if (this.selectedCtrl === ctrl.id) {
          // Track for drag threshold
          const cell = this.cellFromEvent(e)
          this._gridDownStart = { x: e.clientX, y: e.clientY, cell, dragging: false }
          this.$refs.grid.setPointerCapture(e.pointerId)
        } else {
          this.selectedCtrl = ctrl.id
          this.repositionConfigPopup()
        }
        return
      }

      e.target.closest('.grid-control').setPointerCapture(e.pointerId)
      this.activePointers[ctrl.id] = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startVal: this.controlValues[ctrl.id] ?? 0
      }

      if (ctrl.type === 'button') {
        this.controlValues[ctrl.id] = 127
        this.sendValue(ctrl)
      } else if (ctrl.type === 'toggle') {
        this.controlValues[ctrl.id] = (this.controlValues[ctrl.id] ?? 0) > 0 ? 0 : 127
        this.sendValue(ctrl)
      }
    },

    onControlMove(e, ctrl) {
      const active = this.activePointers[ctrl.id]
      if (!active || active.pointerId !== e.pointerId) return

      const el = e.target.closest('.grid-control')
      if (!el) return
      const rect = el.getBoundingClientRect()

      if (ctrl.type === 'knob') {
        const dy = active.startY - e.clientY
        this.controlValues[ctrl.id] = Math.max(0, Math.min(127, active.startVal + (dy / 150) * 127))
        this.sendValue(ctrl)
      } else if (ctrl.type === 'fader') {
        if (ctrl.colSpan > ctrl.rowSpan) {
          this.controlValues[ctrl.id] = Math.max(0, Math.min(127, ((e.clientX - rect.left) / rect.width) * 127))
        } else {
          this.controlValues[ctrl.id] = Math.max(0, Math.min(127, (1 - (e.clientY - rect.top) / rect.height) * 127))
        }
        this.sendValue(ctrl)
      } else if (ctrl.type === 'xypad') {
        this.controlValues[ctrl.id] = Math.max(0, Math.min(127, ((e.clientX - rect.left) / rect.width) * 127))
        this.xyValues[ctrl.id] = Math.max(0, Math.min(127, (1 - (e.clientY - rect.top) / rect.height) * 127))
        this.sendValue(ctrl)
      }
    },

    onControlUp(e, ctrl) {
      delete this.activePointers[ctrl.id]
      if (ctrl.type === 'button') {
        this.controlValues[ctrl.id] = 0
        this.sendValue(ctrl)
      }
    },

    sendValue(ctrl) {
      if (!this.engine) return
      this.engine.sendCC(ctrl.cc, Math.round(this.controlValues[ctrl.id] ?? 0))
      if (ctrl.type === 'xypad' && ctrl.cc2 != null) {
        this.engine.sendCC(ctrl.cc2, Math.round(this.xyValues[ctrl.id] ?? 0))
      }
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

  span
    font-size: 12px
    color: #888
    min-width: 16px
    text-align: center

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

.panel-grid
  flex: 1
  overflow: auto
  position: relative

  &.selecting
    cursor: crosshair
    touch-action: none

  &.locked
    overflow: hidden
    touch-action: none

.grid-inner
  position: relative

.grid-cell
  position: absolute
  background: #222
  border-radius: 3px

  &.highlight
    background: rgba(255, 136, 0, 0.3)
    outline: 1px solid #ff8800

.grid-control
  background: #2a2a2a
  border: 1px solid #3a3a3a
  border-radius: 6px
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  position: relative
  overflow: hidden
  touch-action: none
  user-select: none

  &.is-active
    border-color: #ff8800

  &.is-selected
    border: 2px solid #ff8800
    box-shadow: 0 0 8px rgba(255, 136, 0, 0.4)

.control-label
  font-size: 10px
  color: #888
  text-align: center
  position: absolute
  top: 2px
  left: 2px
  right: 2px
  overflow: hidden
  white-space: nowrap
  text-overflow: ellipsis

.control-value
  font-size: 11px
  color: #666
  position: absolute
  bottom: 2px

.knob-svg
  width: 65%
  height: 65%

.fader-track
  background: #333
  border-radius: 3px
  position: relative
  overflow: hidden

  &.vertical
    width: 30%
    height: 80%

  &.horizontal
    width: 80%
    height: 30%

.fader-fill
  position: absolute
  background: #ff8800
  border-radius: 3px

  .vertical &
    bottom: 0
    left: 0
    right: 0

  .horizontal &
    left: 0
    top: 0
    bottom: 0

.xypad-area
  width: 85%
  height: 85%
  background: #333
  border-radius: 4px
  position: relative

.xypad-dot
  position: absolute
  width: 12px
  height: 12px
  background: #ff8800
  border-radius: 50%
  transform: translate(-50%, -50%)

.btn-indicator
  width: 50%
  height: 50%
  border-radius: 50%
  background: #444
  transition: background 0.1s

  &.on
    background: #ff8800
    box-shadow: 0 0 8px #ff8800

.floating-popup
  position: fixed
  left: 0
  top: 0
  z-index: 201
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

.slider-group
  display: flex
  align-items: center
  gap: 8px

  input[type="range"]
    width: 100px
    accent-color: #ff8800
    height: 32px

  .slider-value
    font-size: 14px
    color: #888
    min-width: 24px
</style>
