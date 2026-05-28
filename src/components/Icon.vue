<template>
  <svg
    :viewBox="def.viewBox"
    :width="size"
    :height="size"
    v-bind="def.attrs"
    v-html="def.content"
  ></svg>
</template>

<script>
const ICONS = {
  close: {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
    content: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'
  },
  'lock-closed': {
    viewBox: '0 0 20 20',
    attrs: {},
    content: '<rect x="3" y="9" width="14" height="9" rx="2" fill="currentColor"/><path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
  },
  'lock-open': {
    viewBox: '0 0 20 20',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
    content: '<rect x="3" y="9" width="14" height="9" rx="2"/><path d="M6 9V6a4 4 0 0 1 8 0v3"/>'
  },
  move: {
    viewBox: '0 0 20 20',
    attrs: { fill: 'currentColor' },
    content: '<path d="M10 2l3 3H7l3-3zM10 18l-3-3h6l-3 3zM2 10l3-3v6l-3-3zM18 10l-3 3V7l3 3z"/>'
  },
  knob: {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    content: '<circle cx="12" cy="12" r="7"/><line x1="12" y1="12" x2="8" y2="8" stroke-linecap="round"/>'
  },
  fader: {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    content: '<line x1="12" y1="4" x2="12" y2="20" stroke-linecap="round"/><rect x="6" y="13" width="12" height="4" rx="1" fill="currentColor" stroke="none"/>'
  },
  button: {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    content: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>'
  },
  toggle: {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    content: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.5" fill="currentColor" stroke="none"/>'
  },
  'xy-pad': {
    viewBox: '0 0 24 24',
    attrs: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    content: '<rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="9" x2="20" y2="9" stroke-dasharray="1 2" opacity="0.5"/><line x1="15" y1="4" x2="15" y2="20" stroke-dasharray="1 2" opacity="0.5"/><circle cx="15" cy="9" r="2" fill="currentColor" stroke="none"/>'
  }
}

export default {
  name: 'Icon',

  props: {
    name: { type: String, required: true },
    size: { type: Number, default: 16 }
  },

  computed: {
    def() {
      return ICONS[this.name] || { viewBox: '0 0 24 24', attrs: {}, content: '' }
    }
  }
}
</script>
