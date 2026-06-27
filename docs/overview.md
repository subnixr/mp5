# MP5 — Overview & CLI

## What is MP5

MP5 is an Electron app that runs p5.js sketches driven by time and optional audio analysis. It has two operating modes:

- **Preview** — interactive window with audio playback and a controls overlay
- **Render** — headless export to a video file via ffmpeg, frame by frame

Pass a directory as the sketch path to activate **gallery mode**: all sketch items in the folder are loaded as a playlist you can cycle through with `Tab` / `Shift+Tab`. See [gallery.md](gallery.md) for details.

## Audio input

### File input

An audio file is loaded and played back through the app. The sketch receives frequency analysis derived from the file's audio data. Time is the track's playback position — it responds to play, pause, seek, and loop.

Supported formats: mp3, ogg, wav, aac, flac, m4a.

### Mic input

The sketch receives live frequency analysis from the system microphone. There is no track, no duration, and no seek. Time is wall-clock time. Mic mode is only available in preview; rendering from the settings window while in mic mode produces a video with no audio stream. Starting a render in mic mode shows a confirmation dialog before proceeding.

Switching from mic back to file resumes the previously loaded file. Switching from file to mic stops playback but keeps the file loaded so it can be resumed.

### No audio

When no audio source is active, `audio.currentTime()` is driven by a virtual clock — a wall-clock timer that starts paused and supports play, pause, and seek. The sketch receives no frequency data (spectrum returns null, all band values return 0). This mode works in both preview and render.

---

## Controls overlay (preview)

The controls bar appears at the bottom of the window. It auto-hides after 3 seconds of mouse inactivity and reappears on mouse move. It can be pinned so it stays visible permanently.

### Widgets

- **MIC / FILE switch** — selects the audio input source.
- **Play / Pause** — starts or pauses the loaded audio file.
- **Loop** — enables or disables looping.
- **Seek / frequency bar** — waveform of the loaded file with a playhead (file mode), or a live frequency spectrum (mic mode or when switched manually).
- **Volume slider** — current output volume level.
- **Params** — opens the settings window to tweak sketch parameters in real time.
- **Gallery** — opens the gallery window to manage the sketch queue (gallery mode only).
- **Sketch picker** — shows the current sketch filename; allows loading a different sketch.
- **Fullscreen** — toggles between windowed and fullscreen.

### Interactions

| Widget                   | Action                                           | Interaction                |
| ------------------------ | ------------------------------------------------ | -------------------------- |
| **MIC / FILE switch**    | Start mic input                                  | Click MIC                  |
|                          | Open audio file picker                           | Click FILE                 |
| **Play / Pause**         | Toggle playback                                  | Click                      |
| **Loop**                 | Toggle loop                                      | Click                      |
| **Seek / frequency bar** | Seek to position (file mode)                     | Click                      |
|                          | Toggle waveform / spectrum view (file mode only) | Right-click                |
| **Volume slider**        | Set volume                                       | Drag                       |
|                          | Adjust volume (shows volume OSD)                 | Scroll wheel               |
|                          | Toggle mute / unmute (shows volume OSD)          | Right-click                |
| **Params**               | Open settings window                             | Click                      |
| **Gallery**              | Open gallery window                              | Click                      |
| **Sketch picker**        | Open sketch file picker                          | Click                      |
|                          | Open current sketch in system editor             | Right-click                |
|                          | Open gallery directory in file manager           | Right-click (gallery mode) |
| **Fullscreen**           | Toggle fullscreen                                | Click                      |

### Keyboard shortcuts

| Key                         | Action                                             |
| --------------------------- | -------------------------------------------------- |
| `Space`                     | Play/pause (file/no-audio) or toggle mic listening |
| `Return`                    | Toggle fullscreen                                  |
| `Left / Right`              | Seek −10 / +10 seconds                             |
| `Shift+Left / Shift+Right`  | Seek −1 / +1 frame (file only)                     |
| `Home / End`                | Seek to start / end (file only)                    |
| `Up / Down`, `WheelScroll`  | Volume +/−                                         |
| `M`                         | Toggle mute                                        |
| `Ctrl+Space`, `Right-click` | Pin / unpin controls                               |
| `Tab / Shift+Tab`           | Next / previous sketch (gallery mode)              |
| `Ctrl+R`                    | Reload window                                      |
| `F10`                       | Open gallery window                                |
| `F11`                       | Toggle fullscreen                                  |
| `F12`                       | Open settings window                               |

### On-screen display (OSD)

A transient overlay centered in the window gives feedback for keyboard/wheel actions:

- **Volume** — level bar on volume change, scroll, or mute toggle.
- **Play / pause / mic** — matching icon when toggling playback or mic input.
- **Seek** — accumulated offset (e.g. `+00:30`) while tapping `Left` / `Right`. Consecutive presses within 500 ms add up and the track is seeked once at the end of the burst; `Home` / `End` cancel a pending seek.

---

## Sketch formats

| Format       | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `sketch.js`  | Single-file sketch                                                      |
| `sketch.zip` | Sketch bundled with assets; must contain `sketch.js` as the entry point |
| `gallery/`   | Directory of sketch items (gallery mode)                                |

A `.zip` sketch is extracted to a temporary directory on launch. Assets inside the zip are accessible via relative paths from `sketch.js`.

## CLI

```
mp5 [SKETCH] [-f] [-p FILE] [-P JSON]
mp5 [SKETCH] <AUDIO> [-f] [-l] [-p FILE] [-P JSON]
mp5 [SKETCH] [AUDIO] -o <OUTPUT> [-S [[HH:]MM:]SS] [-L [[HH:]MM:]SS] [-F FPS] [-g WxH] [-p FILE] [-P JSON]
```

Both arguments are optional and can be given in any order. A `.js` or `.zip` file is treated as the sketch; a directory activates gallery mode; anything else is treated as the audio file. When omitted, the app falls back to sensible defaults and sketch/audio can be loaded from the controls bar.

| Arguments      | Sketch                   | Audio input            |
| -------------- | ------------------------ | ---------------------- |
| _(none)_       | built-in eq log istogram | mic (volume muted)     |
| `SKETCH` only  | provided sketch          | mic (volume muted)     |
| `AUDIO` only   | built-in eq log istogram | file — controls pinned |
| `SKETCH AUDIO` | provided sketch          | file                   |

### Arguments

|          | Description                                                      |
| -------- | ---------------------------------------------------------------- |
| `SKETCH` | Path to sketch `.js` or `.zip` file, or directory (gallery mode) |
| `AUDIO`  | Path to audio file (mp3, ogg, wav, aac, flac, m4a)               |

### Options

| Flag                       | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `-f`                       | Start fullscreen (preview only)                                              |
| `-l`                       | Loop audio (preview only)                                                    |
| `-o OUTPUT`                | Render to output file — activates render mode                                |
| `-S [-][[HH:]MM:]SS[.mmm]` | Animation window start time (render only; default: 0)                        |
| `-L [-][[HH:]MM:]SS[.mmm]` | Animation window length (render only; required if no AUDIO)                  |
| `-F FPS`                   | Render frame rate (default: 60)                                              |
| `-g WxH`                   | Output resolution (default: 1920×1080); overrides `params.canvas()` hint     |
| `-p FILE`                  | Load initial params (and optionally render settings) from a JSON preset file |
| `-P JSON`                  | Pass initial params as an inline JSON string                                 |
| `--help`                   | Show usage                                                                   |

`-p` and `-P` can be combined; inline `-P` values override file `-p` values for the same keys.

### Preset file format

Preset files use a structured envelope so params and render settings can coexist:

```json
{
  "params": { "speed": 2.5, "color": "#00ffcc", "mode": "square" },
  "rendering": { "width": 1920, "height": 1080, "fps": 60 }
}
```

`rendering` is optional. The **Save** button in the settings window always writes the structured envelope. The **Load** button and drag-and-drop accept this format; rendering values in a loaded preset are applied to the settings window immediately.

For combo and grid params, nested objects and flat dotted keys are both valid in `params`:

```json
{ "params": { "colorDef": { "r": 0, "g": 128, "b": 255 } } }
{ "params": { "colorDef.r": 0, "colorDef.g": 128, "colorDef.b": 255 } }
```

### ffmpeg (render mode)

The settings window has a **format** dropdown that controls the output codec:

| Format | Codec flags                            | Alpha |
| ------ | -------------------------------------- | ----- |
| `mp4`  | `-c:v libx264 -pix_fmt yuv420p`        | no    |
| `mov`  | `-c:v prores_ks -pix_fmt yuva444p10le` | yes   |
| `webm` | `-c:v libvpx-vp9 -pix_fmt yuva420p`    | yes   |

Default format is `mov`. The codec flags are exposed in the **ffmpeg extra args** textarea and can be edited freely. `MP5_FFMPEG_EXTRA` or a custom value in the textarea overrides the preset entirely.

#### Transparent video output

The window background is `#000000` (opaque black). For alpha-channel output (`mov` / `webm`), sketches must call `p.clear()` at the start of `draw()` instead of `p.background()` to produce transparent pixels — `p.background()` does not clear the canvas, so a transparent fill has no effect.

### Render progress window

While rendering, a progress window shows the current frame count and a cancel button. Two checkboxes control what happens when the render finishes:

| Option                    | Effect                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| **Quit on finish**        | The app exits automatically when the render completes            |
| **Open folder on finish** | The output folder opens in the system file manager on completion |

### Environment variables

| Variable           | Description                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `MP5_FFMPEG_EXTRA` | Replaces the format-preset codec flags. `-vf scale` from `-g` is always applied regardless. |

### Examples

```sh
# Run with no arguments
mp5

# Preview sketch with audio
mp5 sketch.js track.mp3

# Preview fullscreen, looping
mp5 sketch.js track.mp3 -f -l

# Render to video (length derived from audio duration)
mp5 sketch.js track.mp3 -o out.mp4

# Render a portion of the animation starting at 10s, 30s long (no audio)
mp5 sketch.js -o out.mp4 -S 10 -L 30

# Render a 30s window starting at 10s with audio overlay
mp5 sketch.js track.mp3 -o out.mp4 -S 10 -L 30

# Render a fixed-length animation without audio, custom resolution
mp5 sketch.js -o out.mp4 -L 30 -g 1280x720

# Pass initial params
mp5 sketch.js track.mp3 -P '{"speed": 2.5, "color": "#ff0000"}'

# Load a structured preset (params + render settings)
mp5 sketch.js track.mp3 -p preset.json

# Preview a zipped sketch with assets
mp5 sketch.zip track.mp3

# Render a zipped sketch
mp5 sketch.zip track.mp3 -o out.mp4
```
