import ControlPanelConfig from '../models/ControlPanelConfig.js'

const STORAGE_KEY = 'touchmpe-controls'

export function loadControlConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      delete parsed.panelX
      delete parsed.panelY
      delete parsed.panelW
      delete parsed.panelH
      delete parsed.gridCols
      if (parsed.panelSize > 80) parsed.panelSize = 30
      return new ControlPanelConfig(parsed)
    }
  } catch (e) {
    // ignore
  }
  return new ControlPanelConfig()
}

export function saveControlConfig(config) {
  try {
    const data = config instanceof ControlPanelConfig ? config.toJSON() : config
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // ignore
  }
}
