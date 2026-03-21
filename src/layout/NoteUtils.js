const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK_KEY_SET = new Set([1, 3, 6, 8, 10])

export function noteNameShort(midiNote) {
  return NOTE_NAMES[midiNote % 12]
}

export function noteNameFull(midiNote) {
  const octave = Math.floor(midiNote / 12) - 1
  return NOTE_NAMES[midiNote % 12] + octave
}

export function isBlackKey(midiNote) {
  return BLACK_KEY_SET.has(midiNote % 12)
}

export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
}
