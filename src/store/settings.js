const STORAGE_KEY = 'touchmpe-settings'

/**
 * Auto-detect reasonable grid dimensions based on screen size.
 * Aims for pads that are ~60-80px wide (comfortable finger target).
 */
function autoDetectGrid() {
  const w = window.innerWidth
  const h = window.innerHeight - 36 // subtract toolbar height
  const targetPadSize = 70 // ideal pad size in px

  const cols = Math.max(4, Math.min(16, Math.round(w / targetPadSize)))
  const rows = Math.max(2, Math.min(8, Math.round(h / targetPadSize)))
  return { cols, rows }
}

function buildDefaults() {
  const { cols, rows } = autoDetectGrid()
  return {
    // Layout
    preset: 'chromatic',
    cols,
    rows,
    rootNote: 36,
    rowOffset: 5,
    colOffset: 1,
    scale: 'chromatic',
    scaleRoot: 0,

    // MPE
    pitchBendRange: 48,
    memberChannels: 15,

    // Touch
    noteOnQuantize: true,
    slidePitchQuantize: false,
    pressureMode: 'auto'
  }
}

export function loadSettings() {
  const defaults = buildDefaults()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) }
    }
  } catch (e) {
    // ignore
  }
  return defaults
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    // ignore
  }
}
