import Loader from './components/loader.js';
import ErrorBar from './components/errorBar.js';
import Engine from '../../components/engine/index.js';
import { fromNested } from '../../components/engine/preset.js';
import Controls from './components/controls.js';
import { handleErrors } from '../error.js';
import { applyTheme, applyVisualizerBg } from '../../components/theme.js';

import eq from './sketches/eq.js';

function sketchNameFromPath(p) {
  const base = p.split('/').pop();
  return base === 'sketch.js'
    ? p.split('/').slice(-2, -1)[0]
    : base.replace(/\.js$/, '');
}

const loader = Loader(document.querySelector('#loader'));
const errorBar = ErrorBar(document.querySelector('#error-bar'));
const engine = Engine(document.querySelector('#engine'));
const controls = Controls(document.querySelector('#controls'));

let gallery = null;
let isSwitching = false;
let currentRendering = window.args.initialRendering ?? null;
let sketchPath = window.args.sketchPath ?? null;
let sketchDir = window.args.sketchDir ?? null;
let galleryDir = window.args.galleryDir ?? null;
let galleryPaths = window.args.galleryPaths ?? null;
let galleryNames = window.args.galleryNames ?? null;
let galleryPreviews = window.args.galleryPreviews ?? null;

async function importSketch(path, bust = false) {
  if (path) {
    const url = 'file://' + path + (bust ? '?v=' + Date.now() : '');
    const mod = await import(url);
    return mod.default;
  }
}

function pushGalleryState() {
  if (!gallery) return;
  window.api.pushGalleryState({
    paths: gallery.paths,
    currentIndex: gallery.currentIndex,
    enabledPaths: [...gallery.enabledPaths],
    shuffle: gallery.shuffle,
    autoplay: gallery.autoplay,
    previewDir: galleryDir + '/.mp5-previews',
    names: galleryNames ?? {},
    previews: galleryPreviews ?? {},
  });
}

function enabledList() {
  return gallery.paths.filter((p) => gallery.enabledPaths.has(p));
}

function fisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledQueue() {
  gallery.queue = fisherYates(enabledList());
  gallery.queuePos = 0;
}

// the visualizer is the source of truth for rendering state; build a complete
// rendering object from the CLI args and the sketch's canvas hint so the
// settings window can purely reflect it instead of inventing its own defaults
function buildDefaultRendering() {
  const hint = engine.getCanvasHint();
  return {
    width: window.args.width ?? hint?.w ?? 1920,
    height: window.args.height ?? hint?.h ?? 1080,
    fps: window.args.frameRate ?? 60,
  };
}

// single entry point for preset application, shared by the drop handler and the
// settings "load" button so both behave identically. `preset` is the shape
// returned by openPath: { params, rendering }.
function applyPreset(preset) {
  // preset.params is nested; the engine keys params by flat dotted paths
  engine.updateParams(fromNested(preset.params));
  // apply immediately and hand the settings window fresh definitions so it
  // rebuilds from the engine (the source of truth) instead of trying to map
  // raw values onto fields — which breaks for combo/grid/repeater params
  engine.flushParams();
  window.api.setSettingsParams(engine.getParamsDefinitions());

  const r = preset.rendering;
  if (r) {
    currentRendering = { ...(currentRendering ?? {}), ...r };
    window.api.setSettingsRendering(currentRendering);
  }

  if (r?.width && r?.height) {
    window.api.resizeWindow(
      Math.round(r.width * 0.5),
      Math.round(r.height * 0.5),
    );
  } else {
    const hint = engine.getCanvasHint();
    if (hint)
      window.api.resizeWindow(
        Math.round(hint.w * 0.5),
        Math.round(hint.h * 0.5),
      );
  }
}

function galleryNext() {
  const list = enabledList();
  if (!list.length) return;

  if (gallery.shuffle) {
    const next = gallery.queue[gallery.queuePos % gallery.queue.length];
    gallery.queuePos++;
    switchSketch(gallery.paths.indexOf(next));
  } else {
    const pos = list.indexOf(gallery.paths[gallery.currentIndex]);
    switchSketch(gallery.paths.indexOf(list[(pos + 1) % list.length]));
  }
}

function galleryPrev() {
  const list = enabledList();
  if (!list.length) return;

  if (gallery.shuffle) {
    gallery.queuePos = Math.max(0, gallery.queuePos - 2);
    const prev = gallery.queue[gallery.queuePos % gallery.queue.length];
    gallery.queuePos++;
    switchSketch(gallery.paths.indexOf(prev));
  } else {
    const pos = list.indexOf(gallery.paths[gallery.currentIndex]);
    switchSketch(
      gallery.paths.indexOf(list[(pos - 1 + list.length) % list.length]),
    );
  }
}

function resetAutoplay() {
  clearInterval(gallery.autoplayTimer);
  gallery.autoplayTimer = null;
  if (gallery.autoplay > 0)
    gallery.autoplayTimer = setInterval(galleryNext, gallery.autoplay * 1000);
}

function peaksArr() {
  const p = engine.getPeaks(2000);
  return p ? Array.from(p) : null;
}

async function switchSketch(index) {
  if (!gallery || isSwitching) return;
  isSwitching = true;

  await engine.fadeOut();

  gallery.currentIndex = index;
  const newPath = gallery.paths[index];
  window.__sketchPath = newPath;
  const newSketch = await importSketch(newPath);
  await engine.loadSketch(newSketch ?? eq, { clearParams: true });

  const hint = engine.getCanvasHint();
  if (hint) {
    window.api.resizeWindow(Math.round(hint.w * 0.5), Math.round(hint.h * 0.5));
    // a new sketch's canvas hint redefines the render size; keep the source of
    // truth in sync and reflect it in an open settings window
    currentRendering = {
      ...(currentRendering ?? {}),
      width: hint.w,
      height: hint.h,
    };
    window.api.setSettingsRendering(currentRendering);
  }

  sketchPath = newPath;
  window.api.setWatchSketch(newPath);
  controls.setSketchPath(newPath);

  const sketchName = galleryNames?.[newPath] ?? sketchNameFromPath(newPath);
  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    sketchDir: galleryDir,
    mode: engine.getMode(),
    galleryDir: galleryDir,
    galleryPaths: galleryPaths,
    canvasHint: engine.getCanvasHint(),
    audioDuration: engine.getDuration(),
    peaks: peaksArr(),
  });
  pushGalleryState();

  engine.fadeIn();
  isSwitching = false;

  if (!galleryPreviews?.[newPath]) {
    setTimeout(() => {
      const canvas = engine.getInstance()?.canvas;
      if (canvas) {
        window.api
          .saveSketchPreview(
            galleryDir,
            newPath,
            canvas.toDataURL('image/jpeg', 0.85),
          )
          .catch(() => {});
      }
    }, 500);
  }
}

async function main() {
  handleErrors((msg) => {
    errorBar.setMessage(msg);
    errorBar.show();
  });

  controls.attach(engine);

  // apply persisted GUI prefs from the config file at startup; live edits from
  // the settings window arrive later via onAppPrefsUpdate
  const startupPrefs = window.args.appPrefs;
  if (startupPrefs?.theme != null) applyTheme(startupPrefs.theme);
  if (startupPrefs?.bgColor != null) applyVisualizerBg(startupPrefs.bgColor);

  window.api.onSettingsUpdate((_e, obj) => engine.updateParams(obj));

  window.api.onAppPrefsUpdate((p) => {
    if (p.theme != null) applyTheme(p.theme);
    if (p.bgColor != null) applyVisualizerBg(p.bgColor);
  });

  // settings "load" button hands us a file path; parse it the same way as a
  // drop and run it through the shared applyPreset
  window.api.onApplyPresetPath(async (_e, filePath) => {
    const result = await window.api.openPath(filePath);
    if (result.type === 'preset') {
      applyPreset(result);
    } else if (result.type === 'error') {
      errorBar.setMessage(result.message);
      errorBar.show();
    }
  });

  const { audioPath, initialParams } = window.args;

  if (galleryPaths?.length) {
    gallery = {
      paths: galleryPaths,
      currentIndex: 0,
      enabledPaths: new Set(galleryPaths),
      shuffle: false,
      autoplay: 0,
      autoplayTimer: null,
    };
  }

  if (initialParams && Object.keys(initialParams).length)
    engine.setInitialParams(initialParams);
  const sketch = await importSketch(sketchPath);
  await Promise.all([
    audioPath ? engine.loadAudio(audioPath) : engine.loadMic(),
    engine.loadSketch(sketch ?? eq),
  ]);
  let sketchName = sketchPath
    ? (galleryNames?.[sketchPath] ??
      window.args.sketchDisplayName ??
      sketchNameFromPath(sketchPath))
    : null;

  const initialHint = engine.getCanvasHint();
  if (initialHint)
    window.api.resizeWindow(
      Math.round(initialHint.w * 0.5),
      Math.round(initialHint.h * 0.5),
    );

  // complete the rendering state now that the canvas hint is known; any values
  // already supplied (CLI preset, return-from-render) win over the defaults
  currentRendering = {
    ...buildDefaultRendering(),
    ...(currentRendering ?? {}),
  };

  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    sketchDir,
    mode: engine.getMode(),
    canvasHint: engine.getCanvasHint(),
    audioDuration: engine.getDuration(),
    peaks: peaksArr(),
  });

  // -> mic mode
  if (!audioPath) {
    engine.setVolume(0);
  }

  // -> file mode without sketch
  if (!sketch && audioPath) {
    controls.pin();
  }

  loader.hide();

  if (gallery) {
    pushGalleryState();
    resetAutoplay();
    if (!galleryPreviews?.[sketchPath]) {
      setTimeout(() => {
        const canvas = engine.getInstance()?.canvas;
        if (canvas) {
          window.api
            .saveSketchPreview(
              galleryDir,
              sketchPath,
              canvas.toDataURL('image/jpeg', 0.85),
            )
            .catch(() => {});
        }
      }, 500);
    }
  }

  async function reloadSketch() {
    const newSketch = await importSketch(sketchPath, true);
    await engine.loadSketch(newSketch ?? eq);
    window.api.pushSettingsDefs({
      ...engine.getParamsDefinitions(),
      sketchName,
      sketchDir,
      mode: engine.getMode(),
      canvasHint: engine.getCanvasHint(),
      audioDuration: engine.getDuration(),
      peaks: peaksArr(),
    });
  }

  function reloadAudio() {
    location.reload();
  }

  if (sketchPath) window.api.onSketchChanged(reloadSketch);
  if (audioPath) window.api.onAudioChanged(reloadAudio);

  window.api.onGallerySettingsUpdate((_e, obj) => {
    if (!gallery) return;
    if (obj.shuffle != null) {
      gallery.shuffle = obj.shuffle;
      if (obj.shuffle) buildShuffledQueue();
    }
    if (obj.autoplay != null) {
      gallery.autoplay = obj.autoplay;
      resetAutoplay();
    }
    if (obj.enabledPaths) {
      gallery.enabledPaths = new Set(obj.enabledPaths);
      if (gallery.shuffle) buildShuffledQueue();
    }
    if (obj.switchToPath != null) {
      const idx = gallery.paths.indexOf(obj.switchToPath);
      if (idx !== -1) switchSketch(idx);
    }
  });

  window.api.onPushGalleryStateRequest(() => pushGalleryState());

  async function applySketchResult(result) {
    if (result.galleryDir) {
      galleryDir = result.galleryDir;
      galleryPaths = result.galleryPaths;
      galleryNames = result.galleryNames;
      galleryPreviews = result.galleryPreviews ?? null;
      gallery = galleryPaths?.length
        ? {
            paths: galleryPaths,
            currentIndex: 0,
            enabledPaths: new Set(galleryPaths),
            shuffle: false,
            autoplay: 0,
            autoplayTimer: null,
          }
        : null;
      controls.setAttribute('data-gallery-mode', '');
    } else {
      galleryDir = null;
      galleryPaths = null;
      galleryNames = null;
      galleryPreviews = null;
      gallery = null;
      controls.removeAttribute('data-gallery-mode');
    }

    sketchPath = result.path;
    sketchName = result.displayName;
    sketchDir = result.sketchDir ?? null;
    window.__sketchPath = sketchPath;
    const newSketch = await importSketch(sketchPath);
    if (newSketch) {
      await engine.loadSketch(newSketch);
      const hint = engine.getCanvasHint();
      if (hint)
        window.api.resizeWindow(
          Math.round(hint.w * 0.5),
          Math.round(hint.h * 0.5),
        );
      window.api.pushSettingsDefs({
        ...engine.getParamsDefinitions(),
        sketchName,
        sketchDir,
        mode: engine.getMode(),
        canvasHint: engine.getCanvasHint(),
        audioDuration: engine.getDuration(),
        peaks: peaksArr(),
        ...(galleryDir && {
          galleryDir,
          galleryPaths,
          galleryNames,
          galleryPreviews,
        }),
      });
      if (gallery) pushGalleryState();
    }
  }

  controls.addEventListener('sketch-pick', (evt) =>
    applySketchResult(evt.detail),
  );

  controls.addEventListener('open-settings', () => openSettings());

  function pushModeChangedDefs() {
    window.api.pushSettingsDefs({
      ...engine.getParamsDefinitions(),
      sketchName,
      sketchDir,
      mode: engine.getMode(),
      canvasHint: engine.getCanvasHint(),
      audioDuration: engine.getDuration(),
      peaks: peaksArr(),
    });
  }

  controls.addEventListener('mic-switch', pushModeChangedDefs);
  controls.addEventListener('file-switch', pushModeChangedDefs);

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const filePath = window.api.getPathForFile(file);
    if (!filePath) return;
    const result = await window.api.openPath(filePath);
    if (result.type === 'sketch') {
      await applySketchResult(result);
    } else if (result.type === 'audio') {
      await engine.loadAudio(result.path);
    } else if (result.type === 'preset') {
      applyPreset(result);
    } else if (result.type === 'error') {
      errorBar.setMessage(result.message);
      errorBar.show();
    }
  });

  window.api.onRenderingUpdate((_e, r) => {
    currentRendering = { ...(currentRendering ?? {}), ...r };
  });

  function openSettings() {
    window.api.openSettings({
      ...(engine.getParamsDefinitions() ?? { groups: [], fields: [] }),
      sketchName,
      sketchDir,
      mode: engine.getMode(),
      galleryDir: galleryDir ?? null,
      galleryPaths: galleryPaths ?? null,
      galleryNames: galleryNames ?? null,
      canvasHint: engine.getCanvasHint(),
      audioDuration: engine.getDuration(),
      initialRendering: currentRendering,
      peaks: peaksArr(),
    });
  }

  // returning from a render reopens settings so the user lands back where they were
  if (window.args.openSettings) openSettings();

  window.api.onTriggerOpenSettings(() => openSettings());

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F12') {
      openSettings();
    } else if (gallery && e.code === 'Tab') {
      e.preventDefault();
      e.shiftKey ? galleryPrev() : galleryNext();
    }
  });
}

main();
