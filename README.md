# TouchMPE

A browser-based MPE/MIDI controller for touchscreens.

## Getting started

1. Open the app in **Chrome** or **Edge** (Web MIDI required)
2. Tap **MPE** (or **MIDI**) in the top bar and select your MIDI output
3. Play

## Features

- **Multi-touch MPE** — each finger gets its own channel with pitch bend, slide, and pressure
- **MIDI mode** — standard single-channel MIDI output (notes + velocity only)
- **Isomorphic grid** — configurable root note, row/column offsets, and scale filtering
- **Pitch quantize assist** — optional pitch correction that gently pulls toward scale notes
- **CC panel** — customizable control surface with knobs, faders, XY pads, buttons, and toggles
- **Installable** — add to home screen for fullscreen use, works offline

## Controls

| Action | Effect |
|--------|--------|
| Tap pad | Note on |
| Slide horizontal | Pitch bend |
| Slide vertical | Timbre (CC74) |
| Press harder | Aftertouch* |
| Top bar +/- | Octave shift |

*Velocity and pressure detection is experimental — depends on device/browser support for touch force or contact area. Use the pressure mode setting to choose between force, contact area, or a fixed value.*

## CC Panel

- Tap **CC** in the top bar to open
- Right-click or long-press an empty cell to add a control
- Right-click or long-press a control to configure it (label, CC number)
- Tap a highlighted control then drag to resize
- Use the lock button to prevent accidental edits
- Use the layout button to move/resize the panel

## Settings

Tap **Settings** to adjust pad size, root note, row/column offsets, scale, pressure mode, pitch bend range, timbre distance, and gravity assist.

## MPE setup

Default pitch bend range is **48 semitones**. Match this in your synth's MPE settings.
