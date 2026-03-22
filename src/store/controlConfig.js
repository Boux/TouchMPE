const STORAGE_KEY = 'touchmpe-controls'

const DEFAULTS = {
  dockSide: 'right',
  panelSize: 200,
  visible: false,
  gridCols: 6,
  controls: []
}

let nextId = 1

export function loadControlConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const config = { ...DEFAULTS, ...parsed }
      // Restore nextId from existing controls
      for (const ctrl of config.controls) {
        const num = parseInt(ctrl.id?.replace('ctrl-', ''), 10)
        if (num >= nextId) nextId = num + 1
      }
      return config
    }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULTS, controls: [] }
}

export function saveControlConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    // ignore
  }
}

export function generateId() {
  return 'ctrl-' + (nextId++)
}
