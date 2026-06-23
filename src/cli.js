import path from 'path';
import fs from 'fs';

function parseTimestamp(str) {
  const parts = str.split(':').map(Number);
  if (parts.length > 3 || parts.some(isNaN)) return null;
  const [a, b, c] = parts;
  if (parts.length === 1) return a >= 0 ? a : null;
  if (parts.length === 2) return b >= 0 && b < 60 ? a * 60 + b : null;
  return b >= 0 && b < 60 && c >= 0 && c < 60 ? a * 3600 + b * 60 + c : null;
}

const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.wav', '.aac', '.flac', '.m4a']);

const FRAME_RATE = 60;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

export function showHelp() {
  console.log(`Usage:
  mp5 [SKETCH] [-f] [-p FILE] [-P JSON]
  mp5 [SKETCH] <AUDIO> [-f] [-l] [-p FILE] [-P JSON]
  mp5 <SKETCH> [AUDIO] -o <OUTPUT> [-S [[HH:]MM:]SS[.mmm]] [-L [[HH:]MM:]SS[.mmm]] [-F FPS] [-g WxH] [-p FILE] [-P JSON]

Arguments:
  SKETCH       Path to sketch .js or .zip file, or directory (gallery mode)
  AUDIO        Path to audio file (${[...AUDIO_EXTS].join(', ')})

Options:
  -f               Start in fullscreen (preview mode only)
  -l               Start in loop mode (only available with AUDIO)
  -S [[HH:]MM:]SS[.mmm]  Animation window start time (render mode only; default: 0)
  -L [[HH:]MM:]SS[.mmm]  Animation window length (render mode only; required if no AUDIO)
  -o OUTPUT        Render to OUTPUT file (requires AUDIO or -L)
  -F FPS           Frame rate for render mode (default: ${FRAME_RATE})
  -g WxH           Output resolution (default: ${DEFAULT_WIDTH}x${DEFAULT_HEIGHT})
  -p FILE          Load initial params from preset JSON file
  -P JSON          Pass initial params as inline JSON string
  --help           Show this help

Global Mouse/Keyboard shortcuts (preview mode):
  Space                     Play/Pause file, toggle mic input
  Return                    Toggle fullscreen
  Left/Right                Seek -10/+10 seconds
  Home/End                  Seek to start/end (only when playing file)
  M                         Toggle mute
  Up/Down, WheelScroll      Volume up/down
  Tab / Shift+Tab           Next/previous sketch (gallery mode)
  Ctrl+Space, RightClick    Pin/unpin controls
  Ctrl+R                    Reload window
  F12                       Open settings window

Environment variables:
  MP5_FFMPEG_EXTRA  Override ffmpeg encoding args (default: inferred from -o extension: mp4/mov/webm; -vf scale always applied from -g)

Control bar widget interactions:
  MIC / FILE switch   Click MIC: start mic input
                      Click FILE: open audio file picker
  Play / Pause        Click: toggle playback
  Loop                Click: toggle loop
  Seek / freq bar     Click: seek to position (file only)
                      RightClick: toggle waveform/spectrum view (file only)
  Volume slider       Drag: set volume
                      Scroll: adjust volume
                      RightClick: toggle mute
  Params              Click: open settings window
  Gallery             Click: open gallery window (gallery mode only)
  Sketch picker       Click: open sketch file picker
                      RightClick: open current sketch in editor
                      RightClick (gallery mode): open gallery directory in file manager
  Fullscreen          Click: toggle fullscreen
`);
}

export function parseArgs(rawArgv) {
  const argv = rawArgv.filter((a) => a !== '--');
  const raw = {
    sketch: null,
    audio: null,
    output: null,
    length: null,
    start: null,
    loop: null,
    fullscreen: false,
    frameRate: null,
    width: null,
    height: null,
    paramsFile: null,
    paramsJson: null,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      return { help: true };
    } else if (a === '-o') {
      raw.output = argv[++i];
    } else if (a === '-L') {
      raw.length = argv[++i];
    } else if (a === '-S') {
      raw.start = argv[++i];
    } else if (a === '-l') {
      raw.loop = true;
    } else if (a === '-f') {
      raw.fullscreen = true;
    } else if (a === '-F') {
      raw.frameRate = parseInt(argv[++i], 10);
    } else if (a === '-g') {
      const [w, h] = argv[++i].split('x').map(Number);
      raw.width = w;
      raw.height = h;
    } else if (a === '-p') {
      raw.paramsFile = argv[++i];
    } else if (a === '-P') {
      raw.paramsJson = argv[++i];
    } else if (a.startsWith('-')) {
      throw new Error(`unrecognized option '${a}'`);
    } else {
      const resolved = path.resolve(a);
      if (fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) {
        raw.sketch = resolved;
      } else if (['.js', '.zip'].includes(path.extname(a).toLowerCase())) {
        raw.sketch = resolved;
      } else {
        raw.audio = resolved;
      }
    }
    i++;
  }

  if (raw.length && !raw.output) {
    throw new Error('-L is only valid in render mode (requires -o OUTPUT)');
  }
  if (raw.start && !raw.output) {
    throw new Error('-S is only valid in render mode (requires -o OUTPUT)');
  }
  if (raw.output && !raw.audio && !raw.length) {
    throw new Error('render mode without AUDIO requires -L [[HH:]MM:]SS[.mmm]');
  }

  if (raw.sketch) {
    if (!fs.existsSync(raw.sketch)) {
      throw new Error(`sketch not found: ${raw.sketch}`);
    }
  }

  let initialParams = {};
  let initialRendering = {};

  function applyPreset(preset, source) {
    if (typeof preset !== 'object' || Array.isArray(preset))
      throw new Error(`preset must be a JSON object: ${source}`);
    if ('params' in preset || 'rendering' in preset) {
      if (preset.params) Object.assign(initialParams, preset.params);
      if (preset.rendering) Object.assign(initialRendering, preset.rendering);
    } else {
      Object.assign(initialParams, preset);
    }
  }

  if (raw.paramsFile) {
    if (!fs.existsSync(raw.paramsFile))
      throw new Error(`params file not found: ${raw.paramsFile}`);
    applyPreset(
      JSON.parse(fs.readFileSync(raw.paramsFile, 'utf8')),
      raw.paramsFile,
    );
  }
  if (raw.paramsJson) {
    applyPreset(JSON.parse(raw.paramsJson), 'inline JSON');
  }

  if (raw.width != null) initialRendering.width = raw.width;
  if (raw.height != null) initialRendering.height = raw.height;
  if (raw.frameRate != null) initialRendering.fps = raw.frameRate;
  if (raw.audio) {
    if (!fs.existsSync(raw.audio)) {
      throw new Error(`audio not found: ${raw.audio}`);
    }
    const ext = path.extname(raw.audio).toLowerCase();
    if (!AUDIO_EXTS.has(ext)) {
      throw new Error(
        `unsupported audio type '${ext}' (expected: ${[...AUDIO_EXTS].join(', ')})`,
      );
    }
  }

  const d = raw.length != null ? parseTimestamp(raw.length) : null;
  if (raw.length != null && d == null)
    throw new Error(
      `invalid time '${raw.length}' for -L (expected [[HH:]MM:]SS[.mmm])`,
    );
  const s = raw.start != null ? parseTimestamp(raw.start) : null;
  if (raw.start != null && s == null)
    throw new Error(
      `invalid time '${raw.start}' for -S (expected [[HH:]MM:]SS[.mmm])`,
    );

  return {
    help: false,
    sketchPath: raw.sketch,
    audioPath: raw.audio || null,
    loop: raw.loop || null,
    fullscreen: raw.fullscreen,
    mode: raw.output ? 'render' : 'preview',
    output: raw.output || null,
    length: d,
    startTime: s ?? 0,
    frameRate: raw.frameRate ?? FRAME_RATE,
    width: raw.width ?? DEFAULT_WIDTH,
    height: raw.height ?? DEFAULT_HEIGHT,
    initialParams,
    initialRendering: Object.keys(initialRendering).length
      ? initialRendering
      : null,
  };
}
