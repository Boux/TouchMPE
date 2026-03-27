# TouchMPE

A browser-based MPE/MIDI controller for touchscreens.

<img width="1126" height="682" alt="image" src="https://github.com/user-attachments/assets/44f07591-d553-4173-8bba-ec80c81cb16a" />

https://github.com/user-attachments/assets/17ac5916-0cb0-4d1c-b2ad-c5d7fd4cbe9f


## Getting started

1. Open [https://boux.github.io/TouchMPE/](https://boux.github.io/TouchMPE/) in **Chrome** on your Android phone or tablet. Optionally tap the menu and "Add to Home Screen" for fullscreen.

2. Connect your phone to your computer via USB. On Android, go to **Settings > Connected Devices > USB** and select **MIDI**. If you don't see this option, you may need to enable Developer Mode first (Settings > About Phone > tap Build Number 7 times).

   *Note: only tested on stock Android with Chrome. iOS and Samsung devices have not been tested — your mileage may vary.*
<img width="270" height="600" alt="Screenshot (Mar 22, 2026 8_07_04 PM)" src="https://github.com/user-attachments/assets/f51f1992-7805-4dbe-8f75-ac0f0b54db0d" />

3. In TouchMPE's top bar, tap **MPE** and select **USB Peripheral Port** as your MIDI output.
<img width="270" height="600" alt="Screenshot_20260322-200921" src="https://github.com/user-attachments/assets/a5e45999-d562-43aa-a349-08f0671972f0" />

4. In your DAW, your phone should appear as a MIDI device. For example in **Bitwig**, go to Settings > Controllers > Add Controller > select **Roger Linn Design Linnstrument** (or any MPE controller), then set your Android device as the MIDI input/output.
<img width="573" height="147" alt="image" src="https://github.com/user-attachments/assets/e91cf3e6-eedc-4202-85a2-4d1d20cf8765" />

5. Play.

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
- Right-click (desktop) or long-press (touchscreen) an empty cell to add a control
- Right-click or long-press a control to configure it (label, CC number)
- Tap a highlighted control then drag to resize
- Use the lock button to prevent accidental edits
- Use the layout button to move/resize the panel

## Settings

Tap **Settings** to adjust pad size, root note, row/column offsets, scale, pressure mode, pitch bend range, timbre distance, and gravity assist.

## MPE setup

Default pitch bend range is **48 semitones**. Match this in your synth's MPE settings.

## Known issues

<details>
<summary><strong>USB MIDI byte corruption (ghost sustain)</strong></summary>

When using Chrome on Android over USB MIDI, high-throughput MIDI streams can cause **byte-level corruption** in the USB MIDI transport layer. Specifically, the CC number byte of CC 74 (timbre/slide) messages — `0x4A` — gets corrupted to `0x40`, which is **CC 64 (sustain pedal)**. This activates sustain on the affected MPE member channel, causing notes to ring out forever even after releasing them.

#### Symptoms

- Notes sound "stuck" — they sustain indefinitely after releasing your finger
- The note visually releases correctly in TouchMPE (noteOff is sent)
- Happens only in MPE mode, not MIDI mode (MIDI mode self-heals since all notes share one channel)
- More likely with many simultaneous touches and fast sliding
- The panic button may not help (CC 123 All Notes Off respects sustain pedal state)

#### Cause

The corruption occurs **outside the application** — between Chrome's Web MIDI `send()` call and the Linux ALSA MIDI driver receiving the bytes. TouchMPE's own debug interceptor confirms clean bytes leaving the app, but a MIDI monitor on the receiving end shows corrupted CC 64 messages arriving. The corruption is triggered by high message throughput overwhelming the USB MIDI transport.

#### Mitigations applied

1. **Message deduplication** — pitch bend, timbre (CC 74), and pressure values are only sent when they actually change, dramatically reducing redundant messages during multitouch
2. **Single `send()` per frame** — all pending MIDI bytes are flushed in one `send()` call instead of individual calls per message, reducing USB transfer overhead
3. **Pressure disabled** — aftertouch/pressure messages are disabled by default since they are unreliable on touch devices and add significant throughput
4. **Improved panic** — the panic button now sends CC 120 (All Sound Off) + CC 64 value 0 (sustain off) + CC 123 (All Notes Off) on all channels, which properly clears stuck sustain state

</details>
