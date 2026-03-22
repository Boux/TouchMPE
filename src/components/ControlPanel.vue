<template>
  <div
    class="control-panel"
    :class="['dock-' + config.dockSide]"
    :style="panelStyle"
  >
    <div class="panel-resize-handle" @pointerdown.prevent="startResize"></div>

    <div
      ref="grid"
      class="panel-grid"
      :class="{ selecting: selectedCtrl }"
      :style="gridStyle"
      @pointerdown.prevent="onGridDown"
      @pointermove.prevent="onGridMove"
      @pointerup.prevent="onGridUp"
      @pointercancel.prevent="onGridUp"
      @contextmenu.prevent="onGridContext"
    >
      <!-- Empty cells -->
      <div
        v-for="cell in emptyCells"
        :key="'e-' + cell.col + '-' + cell.row"
        :ref="'cell-' + cell.col + '-' + cell.row"
        class="grid-cell"
        :class="{ highlight: isCellInDrag(cell.col, cell.row) }"
        :style="cellStyle(cell)"
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
        :style="controlPosStyle(ctrl)"
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

    <!-- Add control popup -->
    <div v-if="popup" ref="addPopup" class="floating-popup">
      <label>
        Grid Size
        <div class="slider-group">
          <input type="range" :value="config.gridCols" min="3" max="12" step="1"
            @input="updateGridCols(+$event.target.value)" />
          <span class="slider-value">{{ config.gridCols }}</span>
        </div>
      </label>
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
    <div v-if="configCtrl" ref="configPopup" class="floating-popup">
      <label>
        Label
        <input type="text" v-model="configCtrl.label" @input="saveConfig" />
      </label>
      <label>
        CC Number
        <input type="number" v-model.number="configCtrl.cc" min="0" max="127" @input="saveConfig" />
      </label>
      <label v-if="configCtrl.type === 'xypad'">
        CC Y-Axis
        <input type="number" v-model.number="configCtrl.cc2" min="0" max="127" @input="saveConfig" />
      </label>
      <button class="delete-config-btn" @click="deleteControl(configCtrl.id); configCtrl = null">
        Delete Control
      </button>
      <button @click="configCtrl = null">Close</button>
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
      configCtrl: null,
      selectedCtrl: null,
      dragStart: null,
      dragEnd: null,
      controlValues: {},
      xyValues: {},
      activePointers: {},
      resizing: false,
      resizeStart: null,
      cellSize: 50
    }
  },

  mounted() {
    this.computeCellSize()
    this._resizeObs = new ResizeObserver(() => this.computeCellSize())
    this._resizeObs.observe(this.$refs.grid)
    this._onDocClick = (e) => {
      if (this.popup && this.$refs.addPopup && !this.$refs.addPopup.contains(e.target)) {
        this.popup = null
      }
      if (this.configCtrl && this.$refs.configPopup && !this.$refs.configPopup.contains(e.target)) {
        this.configCtrl = null
      }
    }
    document.addEventListener('pointerdown', this._onDocClick, true)
  },

  beforeUnmount() {
    if (this._resizeObs) this._resizeObs.disconnect()
    document.removeEventListener('pointerdown', this._onDocClick, true)
  },

  computed: {
    isHorizontal() {
      return this.config.dockSide === 'left' || this.config.dockSide === 'right'
    },

    panelStyle() {
      return this.isHorizontal
        ? { width: this.config.panelSize + 'px' }
        : { height: this.config.panelSize + 'px' }
    },

    gridStyle() {
      const cols = this.config.gridCols || 6
      return {
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: this.cellSize + 'px'
      }
    },

    gridRows() {
      let maxRow = this.config.gridCols
      for (const ctrl of this.config.controls) {
        maxRow = Math.max(maxRow, ctrl.row + ctrl.rowSpan)
      }
      return Math.max(maxRow, 8)
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
      const cols = this.config.gridCols || 6
      const cells = []
      for (let row = 0; row < this.gridRows; row++) {
        for (let col = 0; col < cols; col++) {
          if (!this.occupiedSet.has(col + ',' + row)) {
            cells.push({ col, row })
          }
        }
      }
      return cells
    }
  },

  methods: {
    computeCellSize() {
      const grid = this.$refs.grid
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const cols = this.config.gridCols || 6
      const gap = 2
      const padding = 6
      this.cellSize = Math.floor((rect.width - padding * 2 - (cols - 1) * gap) / cols)
    },

    cellFromEvent(e) {
      const grid = this.$refs.grid
      if (!grid) return null
      const rect = grid.getBoundingClientRect()
      const padding = 6
      const gap = 2
      const cols = this.config.gridCols || 6
      const step = this.cellSize + gap

      const x = e.clientX - rect.left - padding
      const y = e.clientY - rect.top - padding + grid.scrollTop
      const col = Math.floor(x / step)
      const row = Math.floor(y / step)
      if (col < 0 || col >= cols || row < 0) return null
      return { col, row }
    },

    cellStyle(cell) {
      return {
        gridColumn: `${cell.col + 1}`,
        gridRow: `${cell.row + 1}`
      }
    },

    controlPosStyle(ctrl) {
      return {
        gridColumn: `${ctrl.col + 1} / span ${ctrl.colSpan}`,
        gridRow: `${ctrl.row + 1} / span ${ctrl.rowSpan}`
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

      // If a control is selected, start drag to resize/move
      if (this.selectedCtrl) {
        if (!this.isCellOccupied(cell.col, cell.row)) {
          this.dragStart = cell
          this.dragEnd = cell
          this.$refs.grid.setPointerCapture(e.pointerId)
        }
        return
      }
    },

    onGridMove(e) {
      if (this.selectedCtrl && this.dragStart) {
        const cell = this.cellFromEvent(e)
        if (cell) this.dragEnd = cell
      }
    },

    onGridUp(e) {
      if (this.selectedCtrl && this.dragStart && this.dragEnd) {
        this.resizeSelectedTo(this.dragStart, this.dragEnd)
      }
      this.dragStart = null
      this.dragEnd = null

      // Tap on empty cell with selected ctrl → move it there
      if (this.selectedCtrl && !this.dragStart) {
        const cell = this.cellFromEvent(e)
        if (cell && !this.isCellOccupied(cell.col, cell.row)) {
          this.moveSelectedTo(cell)
        }
      }
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
        cc: ccDefaults[type],
        col: cell.col,
        row: cell.row,
        colSpan: 1,
        rowSpan: 1
      }
      if (type === 'xypad') ctrl.cc2 = 2
      this.config.controls.push(ctrl)
      this.saveConfig()
      this.popup = null
      this.selectedCtrl = ctrl.id
    },

    // --- Selected control actions ---
    moveSelectedTo(cell) {
      const ctrl = this.config.controls.find(c => c.id === this.selectedCtrl)
      if (!ctrl) return
      // Check no collision at new position
      for (let r = cell.row; r < cell.row + ctrl.rowSpan; r++) {
        for (let c = cell.col; c < cell.col + ctrl.colSpan; c++) {
          if (this.isCellOccupiedByOther(c, r, ctrl.id)) return
        }
      }
      ctrl.col = cell.col
      ctrl.row = cell.row
      this.saveConfig()
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
      this.configCtrl = ctrl
      this.selectedCtrl = ctrl.id
      const refArr = this.$refs['ctrl-' + ctrl.id]
      const anchor = Array.isArray(refArr) ? refArr[0] : refArr
      if (anchor) this.positionFloating(anchor, 'configPopup')
    },

    deleteControl(id) {
      this.config.controls = this.config.controls.filter(c => c.id !== id)
      if (this.selectedCtrl === id) this.selectedCtrl = null
      this.saveConfig()
    },

    updateGridCols(val) {
      this.config.gridCols = val
      this.$nextTick(() => this.computeCellSize())
      this.saveConfig()
    },

    saveConfig() {
      this.$emit('update', this.config)
      saveControlConfig(this.config)
    },

    // --- Panel resize handle ---
    startResize(e) {
      this.resizing = true
      this.resizeStart = { x: e.clientX, y: e.clientY, size: this.config.panelSize }
      const onMove = (e) => {
        if (!this.resizing) return
        const side = this.config.dockSide
        let delta
        if (side === 'right') delta = this.resizeStart.x - e.clientX
        else if (side === 'left') delta = e.clientX - this.resizeStart.x
        else if (side === 'bottom') delta = this.resizeStart.y - e.clientY
        else delta = e.clientY - this.resizeStart.y
        this.config.panelSize = Math.max(100, Math.min(500, this.resizeStart.size + delta))
        this.$nextTick(() => this.computeCellSize())
      }
      const onUp = () => {
        this.resizing = false
        this.saveConfig()
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
      }
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },

    // --- Control interaction (play mode) ---
    onControlDown(e, ctrl) {
      if (this.selectedCtrl) {
        if (this.selectedCtrl === ctrl.id) {
          // Drag from the selected control itself to move/resize
          const cell = this.cellFromEvent(e)
          if (cell) {
            this.dragStart = cell
            this.dragEnd = cell
            this.$refs.grid.setPointerCapture(e.pointerId)
          }
        } else {
          this.deselectCtrl()
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

.panel-resize-handle
  position: absolute
  z-index: 10
  background: #444

  .dock-left &
    right: 0
    top: 0
    width: 4px
    height: 100%
    cursor: ew-resize

  .dock-right &
    left: 0
    top: 0
    width: 4px
    height: 100%
    cursor: ew-resize

  .dock-top &
    bottom: 0
    left: 0
    height: 4px
    width: 100%
    cursor: ns-resize

  .dock-bottom &
    top: 0
    left: 0
    height: 4px
    width: 100%
    cursor: ns-resize

.panel-grid
  flex: 1
  display: grid
  gap: 2px
  padding: 6px
  align-content: start
  overflow-y: auto
  touch-action: none

  &.selecting
    cursor: crosshair

.grid-cell
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
