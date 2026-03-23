# TouchMPE

A browser-based MPE/MIDI controller for touchscreens.

## Getting started

1. Open [https://boux.github.io/TouchMPE/](https://boux.github.io/TouchMPE/) in **Chrome** on your Android phone or tablet. Optionally tap the menu and "Add to Home Screen" for fullscreen.

2. Connect your phone to your computer via USB. On Android, go to **Settings > Connected Devices > USB** and select **MIDI**. If you don't see this option, you may need to enable Developer Mode first (Settings > About Phone > tap Build Number 7 times).
   *Note: only tested on stock Android with Chrome. iOS and Samsung devices have not been tested — your mileage may vary.*
<img width="1080" height="2400" alt="Screenshot (Mar 22, 2026 8_07_04 PM)" src="https://github.com/user-attachments/assets/5aee7a66-a7d5-45dd-a8a4-73ffbe0af839" />

4. In TouchMPE's top bar, tap **MPE** and select **USB Peripheral Port** as your MIDI output.
<img width="1080" height="2400" alt="Screenshot_20260322-200921" src="https://github.com/user-attachments/assets/b141634c-af4f-47fc-af1d-9185966a09d2" />

5. In your DAW, your phone should appear as a MIDI device. For example in **Bitwig**, go to Settings > Controllers > Add Controller > select **Roger Linn Design Linnstrument** (or any MPE controller), then set your Android device as the MIDI input/output.
<img width="573" height="147" alt="image" src="https://github.com/user-attachments/assets/e91cf3e6-eedc-4202-85a2-4d1d20cf8765" />

6. Play.

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
