<template>
  <canvas ref="canvas" class="grid-canvas"></canvas>
</template>

<script>
import GridRenderer from '../engine/GridRenderer.js'
import TouchHandler from '../engine/TouchHandler.js'
import MPEEngine from '../engine/MPEEngine.js'
import { computeGrid } from '../layout/KeyboardLayout.js'
import { calcGrid } from '../store/settings.js'

export default {
  name: 'GridCanvas',

  props: {
    settings: { type: Object, required: true },
    midiOutput: { type: Object, required: true }
  },

  emits: ['engine-ready'],

  data() {
    return {
      renderer: null,
      touchHandler: null,
      engine: null,
      animFrameId: null,
      resizeTimeout: null
    }
  },

  mounted() {
    this.renderer = new GridRenderer(this.$refs.canvas)
    this.renderer.onResize = () => this._onGridResize()
    this.engine = new MPEEngine(this.midiOutput)
    this.touchHandler = new TouchHandler(this.$refs.canvas, this.engine, this.renderer)
    this.$emit('engine-ready', this.engine)
    this.applySettings(this.settings)
    this._startRenderLoop()
  },

  beforeUnmount() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    if (this.touchHandler) this.touchHandler.destroy()
    if (this.renderer) this.renderer.destroy()
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout)
  },

  methods: {
    applySettings(settings) {
      const { cols, rows } = calcGrid(settings.padScale || 1.0, this.$refs.canvas)
      const grid = computeGrid({
        cols,
        rows,
        rootNote: settings.rootNote,
        rowOffset: settings.rowOffset,
        colOffset: settings.colOffset,
        scale: settings.scale,
        scaleRoot: settings.scaleRoot
      })
      this.renderer.setGrid(grid)
      this.renderer.mpeMode = settings.mpeMode !== false
      this.renderer.accentColor = settings.accentColor || '#ff8800'
      this.renderer.staticDirty = true
      this.renderer.dynamicDirty = true
      if (this.engine) {
        this.engine.applySettings(settings)
      }
      if (this.touchHandler) {
        this.touchHandler.applySettings(settings)
      }
    },

    _onGridResize() {
      // Debounce rapid resize events, but recalculate grid dimensions
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout)
      this.resizeTimeout = setTimeout(() => {
        this.applySettings(this.settings)
      }, 100)
    },

    _startRenderLoop() {
      const loop = () => {
        if (this.touchHandler) this.touchHandler.tickGravity()
        this.renderer.draw()
        if (this.engine) this.engine.flush()
        this.animFrameId = requestAnimationFrame(loop)
      }
      this.animFrameId = requestAnimationFrame(loop)
    }
  }
}
</script>

<style lang="sass">
.grid-canvas
  flex: 1
  width: 100%
  min-width: 60px
  min-height: 60px
  display: block
</style>
