#!/usr/bin/env python3
"""MIDI Monitor GUI with audio — shows incoming MIDI messages, highlights CC 64,
and plays simple piano-like tones so you can hear stuck/sustained notes."""

import tkinter as tk
from tkinter import ttk
import threading
import queue
import math
import mido
import numpy as np
import sounddevice as sd

MSG_QUEUE = queue.Queue()
SAMPLE_RATE = 44100


class SimpleSynth:
    """Minimal polyphonic synth using sounddevice callback."""

    def __init__(self):
        self.voices = {}  # note -> { freq, phase, amp, releasing }
        self.sustain = False
        self.sustained_notes = set()  # notes held by sustain pedal
        self.volume = 0.4
        self.lock = threading.Lock()
        self.stream = sd.OutputStream(
            samplerate=SAMPLE_RATE, channels=1, dtype='float32',
            callback=self._callback, blocksize=512)
        self.stream.start()

    def _callback(self, outdata, frames, time_info, status):
        buf = np.zeros(frames, dtype=np.float32)
        with self.lock:
            dead = []
            for note, v in self.voices.items():
                freq = v['freq']
                phase = v['phase']
                amp = v['amp']
                t = np.arange(frames) / SAMPLE_RATE
                # Simple sine with harmonics for piano-ish tone
                sig = np.sin(2 * np.pi * freq * t + phase) * 0.6
                sig += np.sin(2 * np.pi * freq * 2 * t + phase * 2) * 0.25
                sig += np.sin(2 * np.pi * freq * 3 * t + phase * 3) * 0.1
                buf += sig * amp
                # Update phase
                v['phase'] = (phase + 2 * np.pi * freq * frames / SAMPLE_RATE) % (2 * np.pi)
                # Envelope: piano-like decay while held, fast release on note off
                if v['releasing']:
                    v['amp'] *= 0.85  # ~40ms release
                    if v['amp'] < 0.001:
                        dead.append(note)
                else:
                    v['amp'] *= 0.9993  # ~1s natural decay while held
            for n in dead:
                del self.voices[n]
        # Soft clip
        peak = max(np.max(np.abs(buf)), 1.0)
        outdata[:, 0] = buf / peak * self.volume

    def note_on(self, note, velocity):
        freq = 440.0 * (2.0 ** ((note - 69) / 12.0))
        amp = velocity / 127.0
        with self.lock:
            self.voices[note] = {'freq': freq, 'phase': 0.0, 'amp': amp, 'releasing': False}

    def note_off(self, note):
        with self.lock:
            if self.sustain:
                self.sustained_notes.add(note)
                return
            if note in self.voices:
                self.voices[note]['releasing'] = True

    def set_sustain(self, on):
        with self.lock:
            self.sustain = on
            if not on:
                # Release all sustained notes
                for note in self.sustained_notes:
                    if note in self.voices:
                        self.voices[note]['releasing'] = True
                self.sustained_notes.clear()

    def panic(self):
        with self.lock:
            for v in self.voices.values():
                v['releasing'] = True
            self.sustain = False
            self.sustained_notes.clear()

    def stop(self):
        self.stream.stop()
        self.stream.close()


class MidiListener(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.port = None
        self.running = True
        self._stop_flag = threading.Event()

    def open_virtual(self, name='MIDI Monitor'):
        self.close()
        self.port = mido.open_input(name, virtual=True)

    def open_port(self, name):
        self.close()
        self.port = mido.open_input(name)

    def close(self):
        if self.port and not self.port.closed:
            self.port.close()
        self.port = None

    def run(self):
        while self.running:
            if self.port and not self.port.closed:
                for msg in self.port.iter_pending():
                    MSG_QUEUE.put(msg)
            self._stop_flag.wait(0.005)


class PianoWidget(tk.Canvas):
    WHITE_NOTES = {0, 2, 4, 5, 7, 9, 11}

    def __init__(self, parent, **kw):
        super().__init__(parent, height=80, bg='#1a1a1a', highlightthickness=0, **kw)
        self.active = {}
        self.bind('<Configure>', lambda e: self.redraw())

    def redraw(self):
        self.delete('all')
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 10:
            return

        white_keys = [n for n in range(128) if n % 12 in self.WHITE_NOTES]
        key_w = max(1, w / len(white_keys))

        xi = 0
        white_x = {}
        for n in white_keys:
            color = '#ff4444' if n in self.active else '#fff'
            self.create_rectangle(xi, 0, xi + key_w - 1, h, fill=color, outline='#333', width=0.5)
            white_x[n] = xi
            xi += key_w

        black_h = h * 0.6
        for n in range(128):
            if n % 12 not in self.WHITE_NOTES:
                lower = n - 1
                upper = n + 1
                if lower in white_x and upper in white_x:
                    bx = (white_x[lower] + white_x[upper]) / 2
                elif lower in white_x:
                    bx = white_x[lower] + key_w * 0.6
                else:
                    continue
                bw = key_w * 0.7
                color = '#cc0000' if n in self.active else '#222'
                self.create_rectangle(bx - bw/2, 0, bx + bw/2, black_h, fill=color, outline='#111', width=0.5)

    def note_on(self, note, channel):
        self.active[note] = channel
        self.redraw()

    def note_off(self, note):
        self.active.pop(note, None)
        self.redraw()

    def clear(self):
        self.active.clear()
        self.redraw()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('MIDI Monitor')
        self.geometry('700x500')
        self.configure(bg='#1a1a1a')

        self.listener = MidiListener()
        self.listener.start()
        self.synth = SimpleSynth()
        self.sustain_count = 0

        self._build_ui()
        self._poll()
        self.protocol('WM_DELETE_WINDOW', self._on_close)

    def _build_ui(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TFrame', background='#1a1a1a')
        style.configure('TLabel', background='#1a1a1a', foreground='#ccc', font=('monospace', 11))
        style.configure('TButton', font=('monospace', 10))
        style.configure('Header.TLabel', font=('monospace', 13, 'bold'), foreground='#ff8800')
        style.configure('Sustain.TLabel', font=('monospace', 14, 'bold'), foreground='#ff4444', background='#1a1a1a')

        top = ttk.Frame(self)
        top.pack(fill='x', padx=8, pady=6)
        ttk.Label(top, text='MIDI Monitor', style='Header.TLabel').pack(side='left')

        port_frame = ttk.Frame(self)
        port_frame.pack(fill='x', padx=8, pady=(0, 6))
        ttk.Label(port_frame, text='Port:').pack(side='left')

        self.port_var = tk.StringVar(value='(virtual) MIDI Monitor')
        self.port_combo = ttk.Combobox(port_frame, textvariable=self.port_var, width=35, state='readonly')
        self.port_combo.pack(side='left', padx=(6, 4))
        self.port_combo.bind('<<ComboboxSelected>>', self._on_port_select)

        ttk.Button(port_frame, text='Refresh', command=self._refresh_ports).pack(side='left', padx=2)
        ttk.Button(port_frame, text='Clear', command=self._clear_log).pack(side='right', padx=2)

        self.vol_var = tk.DoubleVar(value=0.4)
        vol_slider = ttk.Scale(port_frame, from_=0, to=1, variable=self.vol_var,
                               orient='horizontal', command=self._on_volume, length=80)
        vol_slider.pack(side='right', padx=(0, 4))
        ttk.Label(port_frame, text='Vol:').pack(side='right')

        self._refresh_ports()

        self.sustain_label = ttk.Label(self, text='', style='Sustain.TLabel')
        self.sustain_label.pack(fill='x', padx=8)

        self.piano = PianoWidget(self)
        self.piano.pack(fill='x', padx=8, pady=4)

        log_frame = ttk.Frame(self)
        log_frame.pack(fill='both', expand=True, padx=8, pady=(0, 8))

        self.log = tk.Text(log_frame, bg='#111', fg='#aaa', font=('monospace', 10),
                           insertbackground='#aaa', wrap='none', state='disabled',
                           highlightthickness=0, borderwidth=1, relief='solid')
        scrollbar = ttk.Scrollbar(log_frame, command=self.log.yview)
        self.log.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        self.log.pack(fill='both', expand=True)

        self.log.tag_configure('sustain', foreground='#ff4444', font=('monospace', 10, 'bold'))
        self.log.tag_configure('noteon', foreground='#4caf50')
        self.log.tag_configure('noteoff', foreground='#888')
        self.log.tag_configure('cc', foreground='#666')

        self._open_virtual()

    def _refresh_ports(self):
        ports = ['(virtual) MIDI Monitor'] + mido.get_input_names()
        self.port_combo['values'] = ports
        if self.port_var.get() not in ports:
            self.port_var.set(ports[0])

    def _on_port_select(self, event=None):
        name = self.port_var.get()
        if name == '(virtual) MIDI Monitor':
            self._open_virtual()
        else:
            try:
                self.listener.open_port(name)
                self._append(f'Connected to: {name}\n', 'noteon')
            except Exception as e:
                self._append(f'Error: {e}\n', 'sustain')

    def _open_virtual(self):
        try:
            self.listener.open_virtual('MIDI Monitor')
            self._append('Virtual port "MIDI Monitor" opened. Select it in TouchMPE.\n', 'noteon')
        except Exception as e:
            self._append(f'Error opening virtual port: {e}\n', 'sustain')

    def _on_volume(self, val):
        self.synth.volume = float(val)

    def _clear_log(self):
        self.log.configure(state='normal')
        self.log.delete('1.0', 'end')
        self.log.configure(state='disabled')
        self.piano.clear()
        self.synth.panic()
        self.sustain_count = 0
        self.sustain_label.configure(text='')

    def _append(self, text, tag=None):
        self.log.configure(state='normal')
        if tag:
            self.log.insert('end', text, tag)
        else:
            self.log.insert('end', text)
        lines = int(self.log.index('end-1c').split('.')[0])
        if lines > 500:
            self.log.delete('1.0', f'{lines - 500}.0')
        self.log.see('end')
        self.log.configure(state='disabled')

    def _poll(self):
        while not MSG_QUEUE.empty():
            try:
                msg = MSG_QUEUE.get_nowait()
                self._handle(msg)
            except queue.Empty:
                break
        self.after(10, self._poll)

    def _handle(self, msg):
        if msg.type == 'note_on' and msg.velocity > 0:
            self._append(f'NOTE ON   ch={msg.channel:<3} note={msg.note:<4} vel={msg.velocity}\n', 'noteon')
            self.piano.note_on(msg.note, msg.channel)
            self.synth.note_on(msg.note, msg.velocity)
        elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
            self._append(f'NOTE OFF  ch={msg.channel:<3} note={msg.note}\n', 'noteoff')
            self.piano.note_off(msg.note)
            self.synth.note_off(msg.note)
        elif msg.type == 'control_change':
            if msg.control == 64:
                self.sustain_count += 1
                self._append(
                    f'>>> CC 64 SUSTAIN  ch={msg.channel}  val={msg.value} <<<\n', 'sustain')
                self.sustain_label.configure(
                    text=f'!!! SUSTAIN DETECTED x{self.sustain_count}  ch={msg.channel}  val={msg.value} !!!')
                self.synth.set_sustain(msg.value >= 64)
            elif msg.control == 120:
                self._append(f'CC 120 ALL SOUND OFF  ch={msg.channel}\n', 'cc')
                self.synth.panic()
            elif msg.control == 123:
                self._append(f'CC 123 ALL NOTES OFF  ch={msg.channel}\n', 'cc')
                self.synth.panic()
            else:
                self._append(f'CC        ch={msg.channel:<3} cc={msg.control:<4} val={msg.value}\n', 'cc')
        elif msg.type == 'pitchwheel':
            pass
        elif msg.type == 'aftertouch':
            pass
        else:
            self._append(f'{msg}\n', 'cc')

    def _on_close(self):
        self.listener.running = False
        self.listener.close()
        self.synth.stop()
        self.destroy()


if __name__ == '__main__':
    App().mainloop()
