import sheet from './engine.css' with { type: 'css' };
import {
  computePeakGain,
  createFileAudio,
  createMicAudio,
  createLiveFileAudio,
  createVirtualClock,
  precompute,
  PRECOMPUTE_FPS,
} from './audio.js';
import { createParams } from './params.js';
document.adoptedStyleSheets.push(sheet);

function createSlot() {
  const slot = document.createElement('div');
  slot.classList.add('slot');
  return slot;
}

function resumeAudioContext() {
  const ctx = p5.prototype.getAudioContext?.();
  if (ctx?.state !== 'running') ctx?.resume();
}

function initSpeakerGain(speakerGain, targetVolume) {
  if (!p5.soundOut?.audiocontext) return null;
  const ctx = p5.soundOut.audiocontext;
  // p5.sound reconnects output → destination on each new p5 instance; always remove it.
  try {
    p5.soundOut.output.disconnect(ctx.destination);
  } catch (_) {}
  if (speakerGain) return speakerGain;
  const gain = ctx.createGain();
  gain.gain.value = targetVolume;
  p5.soundOut.output.connect(gain);
  gain.connect(ctx.destination);
  return gain;
}

export default function Engine(elem) {
  // index 0: active (front), index 1: loading (back)
  let slots = [createSlot(), createSlot()];
  let instances = [null, null];

  // Audio state
  let audioSource = null;
  let soundFile = null;
  let soundFilePath = null;
  let mic = null;
  let listening = false;
  let speakerGain = null;
  let targetVolume = 1;
  let normGain = 1;

  // Pre-computed analysis state
  let precomputedData = null;
  let precomputePromise = null; // pending until analysis completes
  let renderFps = null; // set for render mode; uses frame-based currentTime
  let startTime = 0;
  let currentSketchFn = null; // stored so loadMic can reload the sketch with correct audio
  let activeAudio = null; // audio object of the current front sketch
  let activeVirtualClock = null; // set when no audio source is active in preview mode
  let activeParams = null; // params instance of the current front sketch
  let preservedParams = {}; // param values persisted across sketch loads

  elem.getInstance = () => instances[0];
  elem.getMode = () =>
    audioSource === mic ? 'mic' : audioSource ? 'file' : '';
  elem.getListening = () => listening;
  elem.getPlaying = () =>
    soundFile?.isPlaying() ?? activeVirtualClock?.isPlaying() ?? false;
  elem.getLoop = () => soundFile?.isLooping() ?? false;
  elem.getVolume = () => targetVolume;
  elem.getCurrentTime = () =>
    soundFile?.currentTime() ?? activeVirtualClock?.currentTime() ?? 0;
  elem.getDuration = () => soundFile?.duration() ?? 0;
  elem.getAudioPath = () => soundFilePath;
  elem.getNormGain = () => (elem.getMode() === 'mic' ? 1 : normGain);
  elem.getAudioSource = () => audioSource;
  elem.getPrecomputedData = () => precomputedData;
  elem.getSpectrum = () => activeAudio?.getSpectrum() ?? null;
  elem.getVolumeLevel = () => activeAudio?.getVolumeLevel() ?? 0;
  elem.getParams = () => activeParams?.getValues() ?? {};
  elem.getParamsDefinitions = () =>
    activeParams?.getDefinitions() ?? { groups: [], fields: [] };
  elem.getCanvasHint = () => activeParams?.canvas?.get?.() ?? null;
  elem.setParams = (obj) => activeParams?.queue(obj);
  elem.updateParams = (obj) => activeParams?.queue(obj);
  // apply queued updates now (instead of at the next draw) so a caller can read
  // them back via getParamsDefinitions in the same tick
  elem.flushParams = () => activeParams?.flush();
  elem.setInitialParams = (obj) => Object.assign(preservedParams, obj);
  elem.setRenderFps = (fps) => {
    renderFps = fps;
  };
  elem.setStartTime = (t) => {
    startTime = t;
  };

  function emitUpdate() {
    const payload = {
      p: elem.getInstance(),
      mode: elem.getMode(),
      listening: elem.getListening(),
      playing: elem.getPlaying(),
      loop: elem.getLoop(),
      volume: elem.getVolume(),
      normGain: elem.getNormGain(),
      currentTime: elem.getCurrentTime(),
      duration: elem.getDuration(),
    };
    elem.dispatchEvent(new CustomEvent('change', { detail: payload }));
  }

  let rafId = null;

  function startPolling() {
    if (rafId) return;
    function tick() {
      if (soundFile?.isPlaying()) {
        emitUpdate();
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  // Deferred mic setup: p5.AudioIn requires AudioWorklet which loads during
  // first p5 sketch init. If loadMic is called before any sketch exists,
  // we defer mic creation to the first onReady callback.
  let micPending = null; // resolve fn to call once mic is created

  const swap = (p) => [p[1], p[0]];
  const display = (e) => (e.style.display = 'block');
  const hide = (e) => (e.style.display = 'none');

  function setupMic() {
    resumeAudioContext();
    if (!mic) mic = new p5.AudioIn();
    mic.connect(); // route through master output so master-FFT sees it
    mic.start();
    audioSource = mic;
    listening = true;
    emitUpdate();
  }

  // Wraps sketch so onReady fires after setup() completes.
  // Creates the appropriate audio object based on current mode.
  function wrapSketch(sketch, onReady) {
    return (p) => {
      let audio;
      if (renderFps) {
        audio = createFileAudio(
          elem,
          () => startTime + (p.frameCount - 1) / renderFps,
          () => p.frameCount === 1,
        );
      } else if (audioSource === mic || micPending) {
        // Lazy: AudioIn/FFT created on first draw(), after AudioWorklet is ready
        audio = createMicAudio(setupMic, () => mic, p);
      } else if (!audioSource) {
        audio = createVirtualClock();
        activeVirtualClock = audio;
      } else {
        audio = createLiveFileAudio(
          () => soundFile,
          p,
          () => normGain,
        );
      }

      const params = createParams();
      sketch(p, audio, params);

      const originalSetup = p.setup || function () {};
      p.setup = function () {
        originalSetup.call(p);

        // wrap draw here so sketches that define p.draw inside setup are covered
        const originalDraw = p.draw || function () {};
        p.draw = function () {
          params.flush();
          originalDraw.call(p);
        };

        // p5.sound is now initialized — init speaker gain
        speakerGain = initSpeakerGain(speakerGain, targetVolume);

        // If loadMic was called before p5 existed, resolve the pending promise.
        // Actual AudioIn/FFT creation is deferred to first draw() via createMicAudio.
        if (micPending) {
          const resolve = micPending;
          micPending = null;
          emitUpdate();
          resolve();
        }

        params.applyPreserved(preservedParams);
        activeAudio = audio;
        onReady(params);
      };
    };
  }

  elem.loadSketch = async (sketch, opts = {}) => {
    currentSketchFn = sketch;

    if (opts.clearParams) {
      preservedParams = {};
    } else if (activeParams) {
      Object.assign(preservedParams, activeParams.getValues());
    }

    // Wait for any in-progress precompute before creating the sketch,
    // so the audio object has data from the first draw call.
    if (precomputePromise) await precomputePromise;

    return new Promise((resolve) => {
      // cancel any pending back instance before loading new one
      instances[1]?.remove();
      instances[1] = null;

      const wrapped = wrapSketch(sketch, (params) => {
        slots = swap(slots);
        instances = swap(instances);

        display(slots[0]);
        hide(slots[1]);

        // Back slot was display:none during load — p5 may have resized canvas to 0.
        // Trigger resize now that the slot is visible.
        instances[0]?.windowResized?.();

        // destroy old front (now sitting in back slot)
        // NOTE: p.remove() tears down p5.sound's shared audio state, breaking
        // any FFT analysers in the new instance. noLoop + DOM clear is enough.
        if (instances[1]) {
          if (activeParams) {
            Object.assign(preservedParams, activeParams.getValues());
            activeParams.destroy();
          }
          instances[1].noLoop();
          slots[1].replaceChildren();
          instances[1] = null;
        }

        activeParams = params;

        emitUpdate();
        resolve();
      });

      instances[1] = new p5(wrapped, slots[1]);
    });
  };

  elem.loadAudio = async (path) => {
    if (!path) {
      if (renderFps) precomputePromise = null;
      return;
    }

    activeVirtualClock = null;
    resumeAudioContext();

    const wasmic = audioSource === mic;

    // Disconnect mic from master output when switching to file mode
    if (mic) mic.disconnect();
    listening = false;

    // Same file — resume (switch back from mic to file)
    if (!wasmic && soundFile && soundFilePath === path) {
      audioSource = soundFile;
      soundFile.play();
      startPolling();
      emitUpdate();
      return Promise.resolve();
    }

    // New file — replace existing
    if (soundFile) {
      soundFile.stop();
      soundFile.disconnect();
    }

    // In render mode, set precomputePromise immediately so loadSketch can await it
    // even if called before the SoundFile's onload fires.
    let resolvePrecompute;
    if (renderFps) {
      precomputePromise = new Promise((r) => {
        resolvePrecompute = r;
      });
    }

    return new Promise((resolve, reject) => {
      soundFile = new p5.SoundFile(
        path,
        async () => {
          normGain = computePeakGain(soundFile.buffer);
          if (renderFps) {
            precomputedData = await precompute(
              soundFile.buffer,
              PRECOMPUTE_FPS,
              undefined,
              normGain,
            );
            resolvePrecompute();
            precomputePromise = null;
          } else {
            soundFile.play();
            startPolling();
          }
          if (wasmic && currentSketchFn) await elem.loadSketch(currentSketchFn);
          emitUpdate();
          resolve();
        },
        (err) => {
          resolvePrecompute?.();
          precomputePromise = null;
          emitUpdate();
          reject(err);
        },
      );
      soundFilePath = path;
      audioSource = soundFile; // set synchronously — sketch construction reads this
    });
  };

  elem.loadMic = async () => {
    soundFile?.stop();

    if (speakerGain) {
      // p5.sound already initialized — create mic directly
      setupMic();
      // Reload sketch so it gets createMicAudio instead of the old file audio object.
      if (currentSketchFn) await elem.loadSketch(currentSketchFn);
      emitUpdate();
      return;
    }

    // p5.sound not yet initialized (no sketch loaded yet).
    // Defer mic creation to first onReady. Sketch will get null audioSource;
    // FFT defaults to master output. Once mic is created and connected to
    // master output, FFT sees the mic signal with no further sketch changes.
    audioSource = null;
    return new Promise((resolve) => {
      micPending = resolve;
    });
  };

  elem.setVolume = (vol) => {
    targetVolume = Math.max(0, Math.min(1, vol));
    if (speakerGain) speakerGain.gain.value = targetVolume;
    emitUpdate();
  };

  elem.listen = (active) => {
    if (!mic) return;
    mic[active ? 'start' : 'stop']();
    listening = active;
    emitUpdate();
  };

  elem.play = () => {
    if (soundFile) {
      if (!soundFile.isPlaying()) {
        soundFile.play();
        startPolling();
        emitUpdate();
      }
    } else if (activeVirtualClock) {
      activeVirtualClock.play();
      emitUpdate();
    }
  };

  elem.seek = (t) => {
    if (soundFile) {
      const clamped = Math.max(0, Math.min(soundFile.duration() - 0.0001, t));
      if (soundFile.isPlaying()) {
        soundFile.jump(clamped);
      } else {
        // p5.SoundFile.jump() no-ops when paused/stopped.
        // Directly update internal position so play() resumes from here
        // and currentTime() reflects the new position immediately.
        const sr = p5.soundOut?.audiocontext?.sampleRate ?? 44100;
        soundFile._lastPos = Math.round(clamped * sr);
        soundFile.pauseTime = clamped;
        soundFile._pauseTime = clamped;
        soundFile._paused = true;
      }
    } else if (activeVirtualClock) {
      activeVirtualClock.jump(t);
    }
    emitUpdate();
  };

  elem.pause = () => {
    soundFile?.pause();
    activeVirtualClock?.pause();
    emitUpdate();
  };

  elem.loop = (active) => {
    soundFile?.setLoop(active);
    emitUpdate();
  };

  slots.forEach((s) => elem.appendChild(s));
  display(slots[0]);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:black;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:5;';
  elem.appendChild(overlay);

  elem.fadeOut = () => {
    overlay.style.opacity = '1';
    return new Promise((r) => setTimeout(r, 200));
  };
  elem.fadeIn = () => {
    overlay.style.opacity = '0';
  };

  return elem;
}
