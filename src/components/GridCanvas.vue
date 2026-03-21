<template>
  <canvas ref="canvas" class="grid-canvas"></canvas>
</template>

<script>
import GridRenderer from '../engine/GridRenderer.js'
import TouchHandler from '../engine/TouchHandler.js'
import MPEEngine from '../engine/MPEEngine.js'
import { computeGrid } from '../layout/KeyboardLayout.js'

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
      animFrameId: null
    }
  },

  mounted() {
    this.renderer = new GridRenderer(this.$refs.canvas)
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
  },

  methods: {
    applySettings(settings) {
      const grid = computeGrid({
        cols: settings.cols,
        rows: settings.rows,
        rootNote: settings.rootNote,
        rowOffset: settings.rowOffset,
        colOffset: settings.colOffset,
        scale: settings.scale,
        scaleRoot: settings.scaleRoot
      })
      this.renderer.setGrid(grid)
      if (this.engine) {
        this.engine.applySettings(settings)
      }
      if (this.touchHandler) {
        this.touchHandler.applySettings(settings)
      }
    },

    _startRenderLoop() {
      const loop = () => {
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
  display: block
</style>
