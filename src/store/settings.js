const STORAGE_KEY = 'touchmpe-settings'

const BASE_PAD_SIZE = 65 // base target pad size in px at scale 1.0

const DEFAULTS = {
  // Layout
  preset: 'chromatic',
  padScale: 1.0, // 0.5 = small pads, 2.0 = large pads
  rootNote: 36,
  rowOffset: 5,
  colOffset: 1,
  scale: 'chromatic',
  scaleRoot: 0,

  // MPE
  mpeMode: true,
  pitchBendRange: 48,
  memberChannels: 15,

  // Touch
  noteOnQuantize: true,
  slidePitchMode: 'continuous',
  gravityPreset: 'medium',
  gravityRadius: 0.5,
  gravityStrength: 0.4,
  gravityDecay: 0.4,
  pressureMode: 'auto',
  timbreDistance: 1
}

/**
 * Calculate cols/rows from screen size and padScale.
 * Returns near-square pads that fill the screen, with slight
 * elasticity on aspect ratio (up to ~1.3:1) to avoid dead space.
 */
export function calcGrid(padScale, canvasEl = null, gap = 3) {
  let w, h
  if (canvasEl) {
    const rect = canvasEl.getBoundingClientRect()
    w = rect.width
    h = rect.height
  } else {
    w = window.innerWidth
    h = window.innerHeight - 36
  }

  const target = BASE_PAD_SIZE * padScale

  // Start with floor to never exceed available space
  let cols = Math.max(3, Math.floor((w + gap) / (target + gap)))
  let rows = Math.max(2, Math.floor((h + gap) / (target + gap)))

  // Iteratively adjust to keep pads near-square (ratio between 0.7 and 1.4)
  for (let i = 0; i < 3; i++) {
    const padW = (w - (cols + 1) * gap) / cols
    const padH = (h - (rows + 1) * gap) / rows
    const ratio = padW / padH

    if (ratio > 1.4 && cols < 30) {
      cols++
    } else if (ratio < 0.7 && rows > 2) {
      rows--
    } else {
      break
    }
  }

  return { cols, rows }
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Remove legacy cols/rows if present
      delete parsed.cols
      delete parsed.rows
      // Migrate old boolean slidePitchQuantize to new mode
      if ('slidePitchQuantize' in parsed) {
        parsed.slidePitchMode = parsed.slidePitchQuantize ? 'instant' : 'continuous'
        delete parsed.slidePitchQuantize
      }
      return { ...DEFAULTS, ...parsed }
    }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULTS }
}

export function saveSettings(settings) {
  try {
    // Don't persist cols/rows — they're always computed
    const { cols, rows, ...rest } = settings
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch (e) {
    // ignore
  }
}
