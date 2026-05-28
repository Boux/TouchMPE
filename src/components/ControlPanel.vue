<template>
  <div
    class="control-panel"
    :class="['dock-' + config.dockSide, { 'is-layout-mode': layoutMode }]"
    :style="panelStyle"
  >
    <LayoutModeOverlay v-if="layoutMode"
      :config="config"
      @done="layoutMode = false"
      @save="saveConfig" />

    <PanelToolbar
      :cell-size="config.cellSize"
      :locked="locked"
      :layout-mode="layoutMode"
      @update-cell-size="updateCellSize"
      @toggle-lock="toggleLock"
      @toggle-layout-mode="layoutMode = !layoutMode" />

    <canvas ref="gridCanvas" class="grid-canvas"></canvas>
    <div ref="popupAnchor" class="popup-anchor"></div>

    <AddControlPopup
      v-if="popup"
      ref="addPopup"
      @select="placeControl"
      @pointerdown="startPopupDrag($event, 'addPopup')" />

    <ConfigControlPopup
      v-if="selectedControl"
      ref="configPopup"
      :control="selectedControl"
      :dimmed="!!(dragStart && dragEnd)"
      @update-label="onUpdateLabel"
      @update-cc="onUpdateCC"
      @change-type="onChangeType"
      @delete="onDelete"
      @pointerdown="startPopupDrag($event, 'configPopup')" />
  </div>
</template>

<script>
import { computePosition, autoPlacement, shift } from '@floating-ui/dom'
import { saveControlConfig } from '../store/controlConfig.js'
import ControlGridRenderer from '../engine/ControlGridRenderer.js'
import ControlGridInput from '../engine/ControlGridInput.js'
import PanelToolbar from './controls/PanelToolbar.vue'
import LayoutModeOverlay from './controls/LayoutModeOverlay.vue'
import AddControlPopup from './controls/AddControlPopup.vue'
import ConfigControlPopup from './controls/ConfigControlPopup.vue'

export default {
  name: 'ControlPanel',
  components: { PanelToolbar, LayoutModeOverlay, AddControlPopup, ConfigControlPopup },

  props: {
    config: { type: Object, required: true },
    engine: { type: Object, default: null },
    accentColor: { type: String, default: '#ff8800' }
  },

  emits: ['update'],

  data() {
    return {
      popup: false,
      popupCell: null,
      selectedCtrl: null,
      dragStart: null,
      dragEnd: null,
      layoutMode: false,
      locked: false,
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
    selectedControl() {
      return this.selectedCtrl ? this.config.findControl(this.selectedCtrl) : null
    }
  },

  mounted() {
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
      onContext: (cell) => {
        if (!this.config.isOccupied(cell.col, cell.row)) {
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
      onDeselect: () => { this.selectedCtrl = null },
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
        const ctrl = this.config.findControl(id)
        return ctrl ? (ctrl.values[key] ?? 0) : 0
      }
    })
    this.input.cellSize = this.config.cellSize
    this.input.controls = this.config.controls
    this.input.locked = this.locked

    this._onDocClick = (e) => {
      if (this.popup && this.$refs.addPopup?.$el && !this.$refs.addPopup.$el.contains(e.target)) {
        this.popup = false
      }
      if (this.selectedCtrl) {
        const inPopup = this.$refs.configPopup?.$el?.contains(e.target)
        const inCanvas = this.$refs.gridCanvas?.contains(e.target)
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
      if (this.input) this.input.cellSize = this.config.cellSize
      this.markDirty()
    },
    'config.controls'() {
      if (this.input) this.input.controls = this.config.controls
      this.markDirty()
    },
    accentColor() { this.markDirty() },
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

    saveConfig() {
      this.$emit('update', this.config)
      saveControlConfig(this.config)
    },

    _startRenderLoop() {
      const loop = () => {
        this.renderer.draw({
          cellSize: this.config.cellSize,
          gap: 2,
          panX: this.panX,
          panY: this.panY,
          controls: this.config.controls,
          selectedCtrl: this.selectedCtrl,
          dragStart: this.dragStart,
          dragEnd: this.dragEnd,
          occupiedSet: this.config.getOccupiedSet(),
          accentColor: this.accentColor
        })
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },

    positionAnchorAtCell(cell) {
      const canvas = this.$refs.gridCanvas
      const anchor = this.$refs.popupAnchor
      if (!canvas || !anchor) return
      const rect = canvas.getBoundingClientRect()
      const step = this.config.cellSize + 2
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
      const step = this.config.cellSize + 2
      anchor.style.left = (rect.left + ctrl.col * step - this.panX) + 'px'
      anchor.style.top = (rect.top + ctrl.row * step - this.panY) + 'px'
      anchor.style.width = (ctrl.colSpan * step - 2) + 'px'
      anchor.style.height = (ctrl.rowSpan * step - 2) + 'px'
    },

    positionFloating(refName) {
      this.$nextTick(() => {
        const popup = this.$refs[refName]
        const anchor = this.$refs.popupAnchor
        const el = popup?.$el || popup
        if (!el || !anchor) return
        computePosition(anchor, el, {
          middleware: [autoPlacement(), shift({ padding: 8 })]
        }).then(({ x, y }) => {
          el.style.left = x + 'px'
          el.style.top = y + 'px'
        })
      })
    },

    repositionConfigPopup() {
      if (!this.selectedCtrl) return
      const ctrl = this.config.findControl(this.selectedCtrl)
      if (ctrl) this.positionAnchorAtCtrl(ctrl)
      this.$nextTick(() => this.positionFloating('configPopup'))
    },

    startPopupDrag(e, refName) {
      if (e.target.closest('input, button')) return
      const el = this.$refs[refName]?.$el
      if (!el) return
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      const startX = e.clientX
      const startY = e.clientY
      const startLeft = parseInt(el.style.left) || 0
      const startTop = parseInt(el.style.top) || 0
      const onMove = (ev) => {
        el.style.left = (startLeft + ev.clientX - startX) + 'px'
        el.style.top = (startTop + ev.clientY - startY) + 'px'
      }
      const onUp = () => {
        el.releasePointerCapture(e.pointerId)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },

    placeControl(type) {
      const cell = this.popupCell
      if (!cell) { this.popup = false; return }
      const ctrl = this.config.addControl(type, cell.col, cell.row)
      this.popup = false
      if (!ctrl) return
      this.saveConfig()
      this.selectedCtrl = ctrl.id
      this.repositionConfigPopup()
      this.markDirty()
    },

    onDelete() {
      if (!this.selectedCtrl) return
      this.config.removeControl(this.selectedCtrl)
      this.selectedCtrl = null
      this.saveConfig()
      this.markDirty()
    },

    onChangeType(newType) {
      const ctrl = this.selectedControl
      if (!ctrl) return
      this.config.changeType(ctrl.id, newType)
      this.saveConfig()
      this.markDirty()
      this.repositionConfigPopup()
    },

    onUpdateLabel(value) {
      const ctrl = this.selectedControl
      if (!ctrl) return
      ctrl.label = value
      this.saveConfig()
      this.markDirty()
    },

    onUpdateCC(key, value) {
      const ctrl = this.selectedControl
      if (!ctrl) return
      ctrl.cc_num[key] = value
      this.saveConfig()
      this.markDirty()
    },

    finishDragResize(from, to) {
      if (!this.selectedCtrl) return
      const c1 = Math.min(from.col, to.col)
      const c2 = Math.max(from.col, to.col)
      const r1 = Math.min(from.row, to.row)
      const r2 = Math.max(from.row, to.row)
      const ok = this.config.resizeControl(this.selectedCtrl, c1, r1, c2 - c1 + 1, r2 - r1 + 1)
      if (ok) {
        this.saveConfig()
        this.repositionConfigPopup()
      }
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

    &.is-current
      border-color: var(--color-accent)
      color: var(--color-accent)
</style>
