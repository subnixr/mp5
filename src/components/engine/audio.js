export const PRECOMPUTE_FPS = 60;

const DEFAULT_BINS = 4096;
// Smaller FFT for transient detection: ~23ms half-window vs ~93ms for DEFAULT_BINS.
// 1024 bins → fftSize=2048 → 5 bins across kick (60-150Hz) — enough coverage without
// the sparse noise of 256 bins (which gave only 2 bins for kick).
const TRANSIENT_BINS = 512;

export function computePeaks(buffer, n) {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / n);
  const peaks = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

export function computePeakGain(buffer, maxGain = 4) {
  const windowSize = 2048;
  let maxRms = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += windowSize) {
      const end = Math.min(i + windowSize, data.length);
      let sum = 0;
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      const rms = Math.sqrt(sum / (end - i));
      if (rms > maxRms) maxRms = rms;
    }
  }
  if (maxRms < 1e-6) return 1;
  return Math.min(maxGain, 1 / maxRms);
}

// OfflineAudioContext renders the entire audio buffer to memory faster than
// real-time. p5.sound has no offline equivalent — p5.FFT requires a live
// audio graph connected to p5.soundOut. We replicate p5.FFT internals here
// so that precomputed data is consistent with live analysis.
// p5.FFT source: https://github.com/processing/p5.js-sound/blob/main/src/fft.js
// p5.Amplitude source: https://github.com/processing/p5.js-sound/blob/main/src/amplitude.js
export async function precompute(
  audioBuffer,
  fps,
  bins = DEFAULT_BINS,
  normGain = 1,
) {
  const { sampleRate, duration, numberOfChannels, length } = audioBuffer;
  const totalFrames = Math.ceil(duration * fps);
  const frameData = new Array(totalFrames);

  const offlineCtx = new OfflineAudioContext(
    numberOfChannels,
    length,
    sampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = offlineCtx.createAnalyser();
  analyser.fftSize = bins * 2;
  analyser.smoothingTimeConstant = 0;

  source.connect(analyser);
  analyser.connect(offlineCtx.destination);
  source.start(0);

  for (let i = 0; i < totalFrames; i++) {
    offlineCtx.suspend(i / fps).then(() => {
      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(spectrum);
      const time = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(time);
      const rms = Math.sqrt(time.reduce((s, v) => s + v * v, 0) / time.length);
      frameData[i] = {
        spectrum,
        amplitude: Math.min(1, rms * normGain),
      };
      offlineCtx.resume();
    });
  }

  await offlineCtx.startRendering();
  return { frameData, sampleRate, fps, duration };
}

function interpolateTimeline(t, config) {
  if (t <= config[0][0]) return config[0][1];
  const last = config[config.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < config.length - 1; i++) {
    const [t0, v0] = config[i];
    const [t1, v1] = config[i + 1];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
}

function makeClock(getTime) {
  return {
    clock(period, offset = 0) {
      function tick() {
        const t = getTime() - offset;
        return (((t / period) % 1) + 1) % 1;
      }
      tick.beat = function () {
        return Math.floor((getTime() - offset) / period);
      };
      return tick;
    },
  };
}

function makeEnvelopeMethod(getTime) {
  // gate mode (default): holds while signal >= threshold
  // trigger mode: fires on rising edge, decays immediately regardless of signal
  function envelopeAR(at, rt, attackFn, releaseFn, trigger = true) {
    let level = 0;
    let lastTime = null;
    let wasAbove = false;
    return (signal, threshold) => {
      const now = getTime();
      const dt = lastTime !== null ? Math.max(0, now - lastTime) : 0;
      lastTime = now;
      const above = signal >= threshold;
      if (trigger) {
        if (above && !wasAbove)
          level = Math.min(1, level + attackFn(Math.min(1, dt / at)));
        else level = Math.max(0, level - releaseFn(Math.min(1, dt / rt)));
        wasAbove = above;
      } else {
        if (above) level = Math.min(1, level + attackFn(Math.min(1, dt / at)));
        else level = Math.max(0, level - releaseFn(Math.min(1, dt / rt)));
      }
      return level;
    };
  }
  envelopeAR.linear = (t) => t;
  envelopeAR.easeOut = (t) => 1 - (1 - t) ** 2;
  envelopeAR.easeIn = (t) => t ** 2;
  envelopeAR.instant = (_t) => 1;

  // 4-stage envelope: Attack → Decay → Sustain → Release
  // sl: sustain level (0-1); decayFn/releaseFn are curve functions same as attackFn
  function envelopeADSR(
    at,
    dt,
    sl,
    rt,
    attackFn,
    decayFn,
    releaseFn,
    trigger = true,
  ) {
    // 0=IDLE, 1=ATTACK, 2=DECAY, 3=SUSTAIN, 4=RELEASE
    let phase = 0;
    let level = 0;
    let releaseFrom = 0; // level captured when release begins
    let lastTime = null;
    let wasAbove = false;

    function enterRelease() {
      releaseFrom = level;
      phase = 4;
    }

    return (signal, threshold) => {
      const now = getTime();
      const elapsed = lastTime !== null ? Math.max(0, now - lastTime) : 0;
      lastTime = now;
      const above = signal >= threshold;

      if (trigger) {
        const rising = above && !wasAbove;
        const falling = !above && wasAbove;
        wasAbove = above;
        if (rising) phase = 1;
        else if (falling && phase !== 0) enterRelease();
      } else {
        if (above && phase === 0) phase = 1;
        else if (!above && (phase === 2 || phase === 3)) enterRelease();
      }

      if (phase === 1) {
        level = Math.min(1, level + attackFn(Math.min(1, elapsed / at)));
        if (level >= 1) phase = 2;
      } else if (phase === 2) {
        level = Math.max(
          sl,
          level - decayFn(Math.min(1, elapsed / dt)) * (1 - sl),
        );
        if (level <= sl) {
          level = sl;
          phase = 3;
        }
      } else if (phase === 3) {
        level = sl;
      } else if (phase === 4) {
        level = Math.max(
          0,
          level - releaseFn(Math.min(1, elapsed / rt)) * releaseFrom,
        );
        if (level <= 0) {
          level = 0;
          phase = 0;
        }
      }

      return level;
    };
  }
  envelopeADSR.linear = envelopeAR.linear;
  envelopeADSR.easeOut = envelopeAR.easeOut;
  envelopeADSR.easeIn = envelopeAR.easeIn;
  envelopeADSR.instant = envelopeAR.instant;

  return { envelopeAR, envelopeADSR };
}

// Mirrors p5.FFT.getEnergy(lo, hi) — same named bands and frequency-to-bin mapping.
// Named bands: "bass" | "lowMid" | "mid" | "highMid" | "treble"
// p5.FFT source: https://github.com/processing/p5.js-sound/blob/main/src/fft.js
const NAMED_BANDS = {
  bass: [20, 140],
  lowMid: [140, 400],
  mid: [400, 2600],
  highMid: [2600, 5200],
  treble: [5200, 14000],
};

function computeBand(spectrum, lo, hi, sampleRate) {
  if (typeof lo === 'string') {
    const band = NAMED_BANDS[lo];
    if (!band) return 0;
    [lo, hi] = band;
  }
  const nyquist = sampleRate / 2;
  const bins = spectrum.length;
  const lo_ = Math.max(
    0,
    Math.min(bins - 1, Math.round((lo / nyquist) * bins)),
  );
  const hi_ =
    hi != null
      ? Math.max(0, Math.min(bins - 1, Math.round((hi / nyquist) * bins)))
      : lo_;
  const a = Math.min(lo_, hi_);
  const b = Math.max(lo_, hi_);
  let sum = 0;
  for (let i = a; i <= b; i++) sum += spectrum[i];
  return sum / (b - a + 1) / 255;
}

// Spectral flux for a band: max(0, current - prev), normalized 0-1.
// Returns 0 if prevSpectrum is null (first frame — no prior state).
function computeBandFlux(currentSpectrum, prevSpectrum, lo, hi, sampleRate) {
  if (!prevSpectrum) return 0;
  const curr = computeBand(currentSpectrum, lo, hi, sampleRate);
  const prev = computeBand(prevSpectrum, lo, hi, sampleRate);
  return Math.max(0, curr - prev);
}

function agc(p = 0.9, n = 300) {
  const buf = [];
  return (value) => {
    buf.push(value);
    if (buf.length > n) buf.shift();
    if (buf.length < 2) return 0;
    const sorted = [...buf].sort((a, b) => a - b);
    const peak = sorted[Math.floor(p * (sorted.length - 1))];
    if (peak < 1e-6) return 0;
    return Math.min(1, value / peak);
  };
}

// Dynamic threshold: asymmetric EMA baseline.
// alphaRise >> alphaFall so transients don't inflate the baseline,
// but the baseline recovers quickly when the signal quiets down.
// Returns (value - baseline*kappa) / (baseline*kappa), clamped [0,1].
function dynamicThreshold(alphaRise = 0.999, alphaFall = 0.97, kappa = 1.5) {
  let baseline = -1;
  return (value) => {
    if (baseline < 0) {
      baseline = value;
      return 0;
    }
    const thr = baseline * kappa;
    const out = value > thr ? Math.min(1, (value - thr) / thr) : 0;
    const alpha = value > baseline ? alphaRise : alphaFall;
    baseline = alpha * baseline + (1 - alpha) * value;
    return out;
  };
}

export async function computeFrameAt(audioBuffer, t, bins = DEFAULT_BINS, normGain = 1) {
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const fftSize = bins * 2;
  const tSample = Math.round(t * sampleRate);
  const startSample = Math.max(0, tSample - fftSize);
  const endSample = Math.min(length, startSample + fftSize * 2);
  const sliceLen = endSample - startSample;

  if (sliceLen < 1) return { spectrum: new Uint8Array(bins), amplitude: 0, sampleRate };

  const offCtx = new OfflineAudioContext(numberOfChannels, sliceLen, sampleRate);
  const sliceBuf = offCtx.createBuffer(numberOfChannels, sliceLen, sampleRate);
  for (let c = 0; c < numberOfChannels; c++) {
    sliceBuf.getChannelData(c).set(
      audioBuffer.getChannelData(c).subarray(startSample, endSample),
    );
  }

  const src = offCtx.createBufferSource();
  src.buffer = sliceBuf;

  const analyser = offCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  analyser.connect(offCtx.destination);
  src.start(0);

  const captureTime = Math.max(1 / sampleRate, (tSample - startSample) / sampleRate);

  let spectrum, amplitude;
  offCtx.suspend(captureTime).then(() => {
    const spec = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(spec);
    spectrum = spec;
    const time = new Float32Array(fftSize);
    analyser.getFloatTimeDomainData(time);
    const rms = Math.sqrt(time.reduce((s, v) => s + v * v, 0) / time.length);
    amplitude = Math.min(1, rms * normGain);
    offCtx.resume();
  });

  await offCtx.startRendering();
  return { spectrum: spectrum ?? new Uint8Array(bins), amplitude: amplitude ?? 0, sampleRate };
}

export function createFileAudio(engine, getTime, isFirstFrame = null) {
  function frame() {
    const data = engine.getPrecomputedData();
    if (!data) return null;
    return Math.min(
      Math.floor(getTime() * data.fps),
      data.frameData.length - 1,
    );
  }

  return {
    duration() {
      return engine.getPrecomputedData()?.duration ?? 0;
    },
    isMic() {
      return false;
    },
    currentTime: getTime,
    millis() {
      return getTime() * 1000;
    },
    getBand(lo, hi) {
      const f = frame();
      if (f === null) return 0;
      const { frameData, sampleRate } = engine.getPrecomputedData();
      return computeBand(frameData[f].spectrum, lo, hi, sampleRate);
    },
    getSpectrum() {
      const f = frame();
      if (f === null) return null;
      return engine.getPrecomputedData().frameData[f].spectrum;
    },
    getVolumeLevel() {
      const f = frame();
      if (f === null) return 0;
      return engine.getPrecomputedData().frameData[f].amplitude;
    },
    timeline(prev, config, smooth = 0.8) {
      const duration = this.duration();
      // Negative t: offset from end of track (e.g. -5 → duration - 5).
      // -0: exactly end of track (duration + 0). Ignored in mic mode (no duration).
      // 1/t < 0 detects both negative numbers and -0 (1/-0 === -Infinity).
      const resolved = this.isMic()
        ? config
        : config.map(([t, v]) => [1 / t < 0 ? duration + t : t, v]);
      const target = interpolateTimeline(this.currentTime(), resolved);
      if (prev == null || isFirstFrame?.()) return target;
      return prev + (target - prev) * smooth;
    },
    transient(lo, hi, w = 15, lookahead = 0) {
      return () => {
        const f = frame();
        if (f === null) return 0;
        const { frameData, sampleRate } = engine.getPrecomputedData();
        const fAdv = Math.min(f + lookahead, frameData.length - 1);
        const prevF = fAdv - w;
        if (prevF < 0) return 0;
        return computeBandFlux(
          frameData[fAdv].spectrum,
          frameData[prevF].spectrum,
          lo,
          hi,
          sampleRate,
        );
      };
    },
    onTimeJump(_cb) {
      return () => {};
    },
    agc,
    dynamicThreshold,
    ...makeClock(getTime),
    ...makeEnvelopeMethod(getTime),
  };
}

// getSoundFile: () => soundFile — getter so callers capture live reference.
// FFT/Amplitude created lazily on first use (inside draw), after p5.sound
// AudioWorklet is fully registered.
export function createLiveFileAudio(getSoundFile, p, getNormGain = () => 1, getPausedFrame = () => null) {
  let fft = null;
  let transientFft = null;
  let amplitude = null;
  let cachedFrame = -1;
  let cachedSpectrum = null;
  let cachedTransientFrame = -1;
  let cachedTransientSpectrum = null;
  let _jumpListeners = [];
  let _lastSeenTime = null;
  let _lastJumpFiredAt = null;

  function init() {
    if (fft) return;
    fft = new p5.FFT(0, DEFAULT_BINS);
    transientFft = new p5.FFT(0, TRANSIENT_BINS);
    amplitude = new p5.Amplitude(0);
  }

  function ensureAnalyzed() {
    init();
    if (p.frameCount !== cachedFrame) {
      cachedSpectrum = fft.analyze();
      cachedFrame = p.frameCount;
    }
  }

  function ensureTransientAnalyzed() {
    init();
    if (p.frameCount !== cachedTransientFrame) {
      cachedTransientSpectrum = transientFft.analyze();
      cachedTransientFrame = p.frameCount;
    }
  }

  return {
    duration() {
      return getSoundFile()?.duration() ?? 0;
    },
    isMic() {
      return false;
    },
    currentTime() {
      const t = getSoundFile()?.currentTime() ?? 0;
      if (
        _lastSeenTime !== null &&
        t < _lastSeenTime - 0.5 &&
        (_lastJumpFiredAt === null || Math.abs(t - _lastJumpFiredAt) >= 0.1)
      ) {
        _lastJumpFiredAt = t;
        _jumpListeners.forEach((cb) => cb(t));
      }
      _lastSeenTime = t;
      return t;
    },
    millis() {
      return this.currentTime() * 1000;
    },
    getBand(lo, hi) {
      const sf = getSoundFile();
      if (sf && !sf.isPlaying()) {
        const frame = getPausedFrame();
        if (!frame) return 0;
        return computeBand(frame.spectrum, lo, hi, frame.sampleRate);
      }
      ensureAnalyzed();
      return fft.getEnergy(lo, hi) / 255;
    },
    getSpectrum() {
      if (getSoundFile() && !getSoundFile().isPlaying()) {
        return getPausedFrame()?.spectrum ?? null;
      }
      ensureAnalyzed();
      return cachedSpectrum;
    },
    getVolumeLevel() {
      if (getSoundFile() && !getSoundFile().isPlaying()) {
        return getPausedFrame()?.amplitude ?? 0;
      }
      init();
      return Math.min(1, amplitude.getLevel() * getNormGain());
    },
    timeline(prev, config, smooth = 0.8) {
      const duration = this.duration();
      // Negative t: offset from end of track (e.g. -5 => duration - 5).
      // -0: exactly end of track (duration + 0). Ignored in mic mode (no duration).
      // 1/t < 0 detects both negative numbers and -0 (1/-0 === -Infinity).
      const resolved = this.isMic()
        ? config
        : config.map(([t, v]) => [1 / t < 0 ? duration + t : t, v]);
      const target = interpolateTimeline(this.currentTime(), resolved);
      return prev == null ? target : prev + (target - prev) * smooth;
    },
    transient(lo, hi, w = 15) {
      const ring = [];
      let lastFrame = -1;
      return () => {
        ensureTransientAnalyzed();
        if (p.frameCount !== lastFrame) {
          ring.push(new Float32Array(cachedTransientSpectrum));
          if (ring.length > w + 1) ring.shift();
          lastFrame = p.frameCount;
        }
        if (ring.length < w + 1) return 0;
        const sampleRate = p5.soundOut?.context?.sampleRate ?? 44100;
        return computeBandFlux(
          ring[ring.length - 1],
          ring[0],
          lo,
          hi,
          sampleRate,
        );
      };
    },
    onTimeJump(cb) {
      _jumpListeners.push(cb);
      return () => {
        const i = _jumpListeners.indexOf(cb);
        if (i !== -1) _jumpListeners.splice(i, 1);
      };
    },
    agc,
    dynamicThreshold,
    ...makeClock(() => getSoundFile()?.currentTime() ?? 0),
    ...makeEnvelopeMethod(() => getSoundFile()?.currentTime() ?? 0),
  };
}

// Defers AudioIn/FFT creation to first use (inside draw), after p5.sound's
// AudioWorklet addModule() has settled. setupMic is the engine's idempotent
// mic initializer; getMic returns the engine-scoped mic reference.
export function createMicAudio(setupMic, getMic, p) {
  let fft = null;
  let transientFft = null;
  let cachedFrame = -1;
  let cachedSpectrum = null;
  let cachedTransientFrame = -1;
  let cachedTransientSpectrum = null;

  function init() {
    if (fft) return;
    setupMic();
    const mic = getMic();
    fft = new p5.FFT(0, DEFAULT_BINS);
    transientFft = new p5.FFT(0, TRANSIENT_BINS);
    if (mic) {
      fft.setInput(mic);
      transientFft.setInput(mic);
    }
  }

  function ensureAnalyzed() {
    init();
    if (p.frameCount !== cachedFrame) {
      cachedSpectrum = fft.analyze();
      cachedFrame = p.frameCount;
    }
  }

  function ensureTransientAnalyzed() {
    init();
    if (p.frameCount !== cachedTransientFrame) {
      cachedTransientSpectrum = transientFft.analyze();
      cachedTransientFrame = p.frameCount;
    }
  }

  return {
    duration() {
      return 0;
    },
    isMic() {
      return true;
    },
    currentTime() {
      return p.millis() / 1000;
    },
    millis() {
      return p.millis();
    },
    getBand(lo, hi) {
      ensureAnalyzed();
      return fft.getEnergy(lo, hi) / 255;
    },
    getSpectrum() {
      ensureAnalyzed();
      return cachedSpectrum;
    },
    getVolumeLevel() {
      ensureAnalyzed();
      return fft.getEnergy(20, 20000) / 255;
    },
    timeline(prev, config, smooth = 0.8) {
      // Negative t: offset from end of track — no meaning in mic mode (no duration).
      // Filter them out and sort so interpolation works correctly.
      // 1/t < 0 detects both negative numbers and -0 (1/-0 === -Infinity).
      const resolved = config
        .filter(([t]) => 1 / t >= 0)
        .sort(([a], [b]) => a - b);
      if (!resolved.length) return prev ?? 0;
      const target = interpolateTimeline(this.currentTime(), resolved);
      return prev == null ? target : prev + (target - prev) * smooth;
    },
    transient(lo, hi, w = 15) {
      const ring = [];
      let lastFrame = -1;
      return () => {
        ensureTransientAnalyzed();
        if (p.frameCount !== lastFrame) {
          ring.push(new Float32Array(cachedTransientSpectrum));
          if (ring.length > w + 1) ring.shift();
          lastFrame = p.frameCount;
        }
        if (ring.length < w + 1) return 0;
        const sampleRate = p5.soundOut?.context?.sampleRate ?? 44100;
        return computeBandFlux(
          ring[ring.length - 1],
          ring[0],
          lo,
          hi,
          sampleRate,
        );
      };
    },
    onTimeJump(_cb) {
      return () => {};
    },
    agc,
    dynamicThreshold,
    ...makeClock(() => p.millis() / 1000),
    ...makeEnvelopeMethod(() => p.millis() / 1000),
  };
}

export function createVirtualClock() {
  let elapsed = 0;
  let startedAt = null; // performance.now() when last resumed; null = paused

  function currentTime() {
    if (startedAt === null) return elapsed;
    return elapsed + (performance.now() - startedAt) / 1000;
  }

  return {
    isMic() {
      return false;
    },
    currentTime,
    millis() {
      return currentTime() * 1000;
    },
    duration() {
      return 0;
    },
    isPlaying() {
      return startedAt !== null;
    },
    play() {
      if (startedAt === null) startedAt = performance.now() - elapsed * 1000;
    },
    pause() {
      if (startedAt !== null) {
        elapsed = currentTime();
        startedAt = null;
      }
    },
    jump(t) {
      elapsed = Math.max(0, t);
      if (startedAt !== null) startedAt = performance.now() - elapsed * 1000;
    },
    setLoop() {},
    getBand() {
      return 0;
    },
    getSpectrum() {
      return null;
    },
    getVolumeLevel() {
      return 0;
    },
    timeline(prev, config, smooth = 0.8) {
      const resolved = config
        .filter(([t]) => 1 / t >= 0)
        .sort(([a], [b]) => a - b);
      if (!resolved.length) return prev ?? 0;
      const target = interpolateTimeline(currentTime(), resolved);
      return prev == null ? target : prev + (target - prev) * smooth;
    },
    transient() {
      return () => 0;
    },
    onTimeJump(_cb) {
      return () => {};
    },
    agc,
    dynamicThreshold,
    ...makeClock(currentTime),
    ...makeEnvelopeMethod(currentTime),
  };
}
