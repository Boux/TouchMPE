import { SCALES } from './NoteUtils.js'

export const PRESETS = {
  chromatic: { rowOffset: 5, colOffset: 1, label: 'Chromatic' },
  guitar:    { rowOffset: 5, colOffset: 1, label: 'Guitar' },
  thirds:    { rowOffset: 4, colOffset: 1, label: 'Thirds' },
  fifths:    { rowOffset: 7, colOffset: 1, label: 'Fifths' },
  wickiHayden: { rowOffset: 7, colOffset: 2, label: 'Wicki-Hayden' }
}

/**
 * Computes the isomorphic grid: maps (row, col) to MIDI note numbers.
 *
 * @param {Object} config
 * @param {number} config.cols - Number of columns (default 12)
 * @param {number} config.rows - Number of rows (default 5)
 * @param {number} config.rootNote - MIDI note of bottom-left pad (default 36 = C2)
 * @param {number} config.rowOffset - Semitones between rows (default 5)
 * @param {number} config.colOffset - Semitones between columns (default 1)
 * @param {string} config.scale - Scale name from SCALES, or 'chromatic' (default)
 * @param {number} config.scaleRoot - Root pitch class 0–11 for scale filtering (default 0 = C)
 *
 * @returns {Array<Array<Object|null>>} 2D grid[row][col], row 0 = top (highest notes)
 *   Each cell: { note, inScale } or null if out of MIDI range
 */
export function computeGrid(config = {}) {
  const {
    cols = 12,
    rows = 5,
    rootNote = 36,
    rowOffset = 5,
    colOffset = 1,
    scale = 'chromatic',
    scaleRoot = 0
  } = config

  const scaleIntervals = SCALES[scale] || SCALES.chromatic
  const scaleSet = new Set(scaleIntervals.map(i => (i + scaleRoot) % 12))

  const effectiveRowOffset = Math.min(rowOffset, cols * colOffset)

  const grid = []
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    const rowFromBottom = rows - 1 - row
    for (let col = 0; col < cols; col++) {
      const note = rootNote + rowFromBottom * effectiveRowOffset + col * colOffset
      if (note < 0 || note > 127) {
        grid[row][col] = null
        continue
      }
      grid[row][col] = {
        note,
        inScale: scaleSet.has(note % 12)
      }
    }
  }
  return grid
}
