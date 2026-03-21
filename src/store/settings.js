const STORAGE_KEY = 'touchmpe-settings'

const DEFAULTS = {
  preset: 'chromatic',
  cols: 12,
  rows: 5,
  rootNote: 36,
  rowOffset: 5,
  colOffset: 1,
  scale: 'chromatic',
  scaleRoot: 0,
  pitchBendRange: 48,
  memberChannels: 15
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) }
    }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULTS }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    // ignore
  }
}
