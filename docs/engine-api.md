# Engine API & Sketch Structure

## Sketch skeleton

A sketch is a `.js` file that exports a default function. The app calls it with `(p, audio, params)`.

```js
export default function (p, audio, params) {
  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = function () {
    p.background(0);
    const level = audio.getVolumeLevel();
    p.circle(p.width / 2, p.height / 2, 300 * level);
  };
}
```

- `p` — p5 instance (standard instance mode)
- `audio` — audio analysis API (documented below)
- `params` — runtime parameters API (see [params-api.md](./params-api.md)); omit if unused

### Time

Always get time from `audio.currentTime()`, not from `p.millis()`. The source of time depends on input mode:

| Mode               | `currentTime()` source                                         |
| ------------------ | -------------------------------------------------------------- |
| File — visualizer  | Track playback position (pauses, seeks correctly)              |
| File — render      | `startTime + (frameCount − 1) / fps` (deterministic)           |
| Mic                | Wall-clock time (`p.millis() / 1000`)                          |
| No audio — visualizer | Virtual clock: starts paused at 0, responds to play/pause/seek |
| No audio — render  | `startTime + (frameCount − 1) / fps` (same as file render)     |

This ensures file-mode and no-audio-render animations are deterministic and react correctly to seek/pause in visualizer mode.

---

## Audio API

### Basic info

```js
audio.isMic(); // boolean — true when input is microphone
audio.currentTime(); // number — current time in seconds
audio.millis(); // number — current time in milliseconds (currentTime × 1000)
audio.duration(); // number — track duration in seconds (0 in mic / no-audio mode)
```

### Volume

```js
audio.getVolumeLevel(); // number [0–1] — RMS amplitude, normalized against track peak
// always 0 in no-audio mode
```

### Frequency analysis

```js
// Full spectrum — Uint8Array, length 4096, values 0–255; null in no-audio mode
audio.getSpectrum();

// Average energy in a frequency range — returns [0–1]; always 0 in no-audio mode
audio.getBand(lo, hi); // lo/hi in Hz
audio.getBand('bass'); // named band shortcut
```

Named bands:

| Name        | Range         |
| ----------- | ------------- |
| `'bass'`    | 20–140 Hz     |
| `'lowMid'`  | 140–400 Hz    |
| `'mid'`     | 400–2600 Hz   |
| `'highMid'` | 2600–5200 Hz  |
| `'treble'`  | 5200–14000 Hz |

### Transient detection

Measures spectral flux in a frequency band — the sudden positive increase in energy between frames. Returns 0 when there is no increase, higher values on transients (kicks, snares, hats). Call once to create the detector, then call the returned function every frame.

```js
// visualizer / mic
const detector = audio.transient(lo, hi, (w = 15));

// render mode — accepts an extra lookahead parameter
const detector = audio.transient(lo, hi, (w = 15), (lookahead = 0));

// inside draw:
const flux = detector(); // [0–1]
```

**Parameters:**

- `lo`, `hi` — frequency range in Hz (or a named band string)
- `w` — window length in frames. Flux is computed between the current frame and `w` frames ago. Larger values smooth out noise; smaller values are more reactive. Typical: 1 (very sharp) to 15 (smoothed).
- `lookahead` _(render only)_ — shifts the detection window forward by this many frames, compensating for the inherent onset lag in spectral flux. Useful to align a visual event with the perceived beat onset.

### Timeline interpolation

Linearly interpolates a value at the current track time from a list of keyframes. Useful for choreographed animations that follow the track structure.

```js
audio.timeline(prev, config, (smooth = 0.8));
```

- `prev` — the value returned last frame (pass `null` on the first call)
- `config` — array of `[time, value]` keyframes in seconds. Negative times are relative to the end of the track (`-5` = 5 s before end, `-0` = exactly at end). Out-of-range times clamp to the first/last keyframe.
- `smooth` — exponential smoothing factor applied after interpolation. `0` = no smoothing, `1` = never moves.

```js
let opacity = null;

p.draw = function () {
  opacity = audio.timeline(opacity, [
    [0, 0],
    [4, 1],
    [-4, 1],
    [-0, 0],
  ]);
  // opacity fades in over the first 4s and out over the last 4s
};
```

### Clock

Generates a repeating phase signal from the current track time. Useful for beat-synced animations, periodic modulation, or strobes when BPM is known.

```js
const clock = audio.clock(period, (offset = 0));

// inside draw:
const phase = clock(); // [0, 1) — position within current cycle
const beat = clock.beat(); // integer — cycle count since t = offset
```

**Parameters:**

- `period` — cycle length in seconds. Use `60 / bpm` to convert from BPM.
- `offset` — time offset in seconds; phase 0 occurs at `t = offset, offset + period, …` (default 0).

```js
// 120 BPM strobe — phase sweeps 0→1 twice per second
const clock = audio.clock(60 / 120);

p.draw = function () {
  const phase = clock();
  p.background(255 * phase);
};
```

```js
// alternate between two states every half-second
const clock = audio.clock(0.5);

p.draw = function () {
  const even = clock.beat() % 2 === 0;
  p.background(even ? 255 : 0);
};
```

### AGC (Auto Gain Control)

Normalizes a signal relative to its recent peak. Useful when raw band energy varies a lot between tracks. Returns a value in [0–1] calibrated against recent history.

```js
const normalize = audio.agc((p = 0.9), (n = 300));

// inside draw:
const normalized = normalize(rawValue);
```

**Parameters:**

- `p` — percentile of the rolling buffer used as the reference peak. `0.9` means "90th percentile of the last `n` samples". Lower values make the gain more aggressive (responds to quieter peaks); higher values are more conservative.
- `n` — rolling buffer length in samples (frames). Controls how quickly the gain adapts. `300` frames ≈ 5 seconds at 60fps. Longer buffers are more stable; shorter buffers track level changes faster.

### Dynamic threshold

Returns a signal relative to a running adaptive baseline. Outputs 0 when the signal is at or below the baseline and rises toward 1 as the signal exceeds the baseline. Good for detecting accents and transients without a fixed threshold.

```js
const detect = audio.dynamicThreshold(
  (alphaRise = 0.999),
  (alphaFall = 0.97),
  (kappa = 1.5),
);

// inside draw:
const signal = detect(rawValue); // [0–1]
```

**Parameters:**

- `alphaRise` — EMA alpha applied when the signal is above the baseline. Values close to 1 make the baseline very slow to rise, so transients above the baseline stay detected for longer. Lower values let the baseline chase the signal upward more quickly, reducing sensitivity to sustained energy.
- `alphaFall` — EMA alpha applied when the signal drops below the baseline. Lower values allow the baseline to recover (fall) more quickly after a loud section, restoring sensitivity sooner.
- `kappa` — multiplier applied to the baseline to set the detection threshold. `kappa = 1.5` means the signal must be 50% above the current baseline to produce output. Increase to require stronger transients; decrease to make detection more sensitive.

### Envelopes

Shape a binary trigger (flux or threshold output) into a smooth animated value. Two variants: AR (attack/release) and ADSR. Both follow the same pattern: call once to create, then call the returned function every frame with a signal and threshold.

```js
const level = env(signal, threshold); // [0–1]
```

#### AR envelope

```js
const env = audio.envelopeAR(at, rt, attackFn, releaseFn, (trigger = true));
```

- `at` — attack time in seconds (time to go from 0 to 1)
- `rt` — release time in seconds (time to go from 1 to 0)
- `attackFn` — curve function for the attack stage
- `releaseFn` — curve function for the release stage
- `trigger` — if `true`, fires on rising edge only (re-triggers if signal drops and rises again). If `false`, holds high while signal stays above threshold (gate mode).

#### ADSR envelope

```js
const env = audio.envelopeADSR(
  at,
  dt,
  sl,
  rt,
  attackFn,
  decayFn,
  releaseFn,
  (trigger = true),
);
```

- `at` — attack time (s)
- `dt` — decay time (s): time to fall from peak to sustain level
- `sl` — sustain level [0–1]: held while signal stays above threshold
- `rt` — release time (s): time to fall from sustain level to 0
- `attackFn`, `decayFn`, `releaseFn` — curve functions
- `trigger` — same as AR: `true` = edge-triggered, `false` = gate

#### Curve functions

Available on both `envelopeAR` and `envelopeADSR`:

| Function   | Shape                      |
| ---------- | -------------------------- |
| `.linear`  | Constant rate              |
| `.easeIn`  | Slow start, fast end       |
| `.easeOut` | Fast start, slow end       |
| `.instant` | Snap immediately to target |

```js
const kick = audio.transient(60, 150, 1);
const env = audio.envelopeAR(
  0.01,
  0.3,
  audio.envelopeAR.instant,
  audio.envelopeAR.easeOut,
);

p.draw = function () {
  const level = env(kick(), 0.3);
  p.circle(p.width / 2, p.height / 2, 200 * level);
};
```

### Time jump callback (visualizer/file only)

Fires when the track is seeked backward. Use to reset stateful animation variables that depend on track position. No-op in render mode.

```js
const unsub = audio.onTimeJump((newTime) => {
  // reset accumulated state
});

// call unsub() to stop listening
```
