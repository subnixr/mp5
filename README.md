<div style="display: flex; gap: 2rem; align-items: center; margin-bottom: 2rem">
    <img src="build/icons/512x512.png" width="128">
    <h3 style="flex: 0 1 75%">Run p5.js sketches driven by audio — both live on screen and rendered to video.</h3>
</div>

MP5 is an Electron app that plays time and audio-driven [p5.js](https://p5js.org) sketches. Point it at a sketch and:

- **Live** — an interactive visualizer window with audio playback, frequency analysis, and a controls overlay.
- **Render** — headless, frame-by-frame export to a video file (via ffmpeg), with optional audio and alpha channel.
- **Devtool** — hot-reload on sketch edits, a live params panel, and a sketch gallery make it a workbench for building visuals.

## Installation & requirements

**ffmpeg is required** — both `ffmpeg` and `ffprobe` must be available in your `PATH` (they back render mode and audio probing).

Install via your package manager (`pacman -S ffmpeg`, `brew install ffmpeg`, `apt install ffmpeg`, …).

### From source

```sh
npm install
npm start            # launches the app
```

### Build a distributable

```sh
npm run dist         # all platforms
npm run dist:linux
npm run dist:mac
npm run dist:win
```

Output lands in `dist/`.

## Usage

```
mp5 [SKETCH] [-f] [-p FILE] [-P JSON] [-c FILE]
mp5 [SKETCH] <AUDIO> [-f] [-l] [-p FILE] [-P JSON] [-c FILE]
mp5 [SKETCH] [AUDIO] -o <OUTPUT> [-S [[HH:]MM:]SS] [-L [[HH:]MM:]SS] [-F FPS] [-g WxH] [-p FILE] [-P JSON] [-c FILE]
```

Both positional arguments are optional and order-independent. A `.js` or `.zip` file is the sketch; a directory activates gallery mode; anything else is treated as the audio file. Passing `-o` switches from visualizer to render mode.

### Arguments

| Argument | Description                                                        |
| -------- | ------------------------------------------------------------------ |
| `SKETCH` | Path to sketch `.js` or `.zip` file, or a directory (gallery mode) |
| `AUDIO`  | Path to audio file (`mp3`, `ogg`, `wav`, `aac`, `flac`, `m4a`)     |

| Given          | Sketch                | Audio input            |
| -------------- | --------------------- | ---------------------- |
| _(none)_       | built-in eq histogram | mic (muted)            |
| `SKETCH` only  | provided sketch       | mic (muted)            |
| `AUDIO` only   | built-in eq histogram | file — controls pinned |
| `SKETCH AUDIO` | provided sketch       | file                   |

### Options

| Flag                       | Description                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| `-f`                       | Start fullscreen (visualizer only)                                         |
| `-l`                       | Loop audio (visualizer only)                                               |
| `-o OUTPUT`                | Render to output file — activates render mode                              |
| `-S [-][[HH:]MM:]SS[.mmm]` | Animation window start time (render only; default: `0`)                    |
| `-L [-][[HH:]MM:]SS[.mmm]` | Animation window length (render only; required if no AUDIO)                |
| `-F FPS`                   | Render frame rate (default: `60`)                                          |
| `-g WxH`                   | Output resolution (default: `1920x1080`); overrides `params.canvas()` hint |
| `-p FILE`                  | Load initial params (and optional render settings) from a JSON preset      |
| `-P JSON`                  | Pass initial params as an inline JSON string                               |
| `-c FILE`                  | Use FILE as the app config (default: platform config dir / `mp5.json`)     |
| `--help`                   | Show usage                                                                 |

`-p` and `-P` combine; inline `-P` values override file `-p` values for the same keys.

### Visualizer shortcuts

| Key                          | Action                                             |
| ---------------------------- | -------------------------------------------------- |
| `Space`                      | Play/pause (file/no-audio) or toggle mic listening |
| `Return` / `F11`             | Toggle fullscreen                                  |
| `Left` / `Right`             | Seek −10 / +10 seconds                             |
| `Shift+Left` / `Shift+Right` | Seek −1 / +1 frame (file only)                     |
| `Home` / `End`               | Seek to start / end (file only)                    |
| `Up` / `Down`, wheel         | Volume +/−                                         |
| `M`                          | Toggle mute                                        |
| `Ctrl+Space`, right-click    | Pin / unpin controls                               |
| `Tab` / `Shift+Tab`          | Next / previous sketch (gallery mode)              |
| `Ctrl+R`                     | Reload window                                      |
| `F10`                        | Open gallery window; focus if open, close if focused |
| `F12`                        | Open settings window; focus if open, close if focused |

The controls bar at the bottom mirrors these actions with clickable widgets (input switch, play/loop, seek/spectrum bar, volume, params, gallery, sketch picker, fullscreen). It auto-hides after 3s and can be pinned.

### Examples

```sh
mp5                                       # built-in eq + mic
mp5 sketch.js track.mp3                   # visualizer
mp5 sketch.js track.mp3 -f -l             # fullscreen, looping
mp5 sketch.js track.mp3 -o out.mp4        # render (length from audio)
mp5 sketch.js -o out.mp4 -S 10 -L 30      # render 30s window from 10s, no audio
mp5 sketch.js -o out.mov -L 30            # transparent (mov) 30s render
mp5 gallery/ track.mp3                    # gallery playlist
mp5 sketch.js track.mp3 -P '{"speed":2.5,"color":"#ff0000"}'
mp5 sketch.js track.mp3 -p preset.json    # params + render settings
```

## General

- **Hot-reload** — the sketch file (and loaded audio) are watched; edits reload the visualizer automatically. Right-click the sketch picker to open the current sketch in your editor.
- **Sketch formats** — a single `sketch.js`, or a `sketch.zip` bundling the sketch with assets (must contain `sketch.js` as entry point; extracted to a temp dir on launch, assets reachable via relative paths).
- **Gallery mode** — pass a directory and all sketch items load as a playlist you cycle with `Tab` / `Shift+Tab`. See [docs/gallery.md](docs/gallery.md).
- **Params** — sketches declare runtime-tweakable values; the settings window (`F12`) renders live controls for them and persists values across reloads. See [docs/params-api.md](docs/params-api.md).
- **Rendering GUI** — the settings window has a render panel: resolution/fps fields, a `format` dropdown (`mp4`, `mov`/alpha, `webm`/alpha) with editable ffmpeg args, save/load of structured presets, and a progress window with quit/open-folder-on-finish options. For transparent output, sketches must use `p.clear()` (not `p.background()`).
- **App settings** — a persistent JSON config (platform config dir / `mp5.json`, or `-c FILE`) holds GUI prefs (theme, visualizer background) and default render geometry/fps. Editable live from the settings window. See [docs/overview.md#app-config](docs/overview.md).

## Docs

- [docs/overview.md](docs/overview.md) — full overview, CLI, render mode, app config
- [docs/params-api.md](docs/params-api.md) — declaring and reading sketch params
- [docs/engine-api.md](docs/engine-api.md) — the `audio` / engine API available to sketches
- [docs/gallery.md](docs/gallery.md) — gallery mode

## License

[GPL-3.0-only](LICENSE)
