import Loader from './components/loader.js';
import ErrorBar from './components/errorBar.js';
import Engine from '../../components/engine/index.js';
import Controls from './components/controls.js';
import WindowSize from './components/windowSize.js';
import { handleErrors } from '../error.js';

import eq from './sketches/eq.js';

const loader = Loader(document.querySelector('#loader'));
const errorBar = ErrorBar(document.querySelector('#error-bar'));
const engine = Engine(document.querySelector('#engine'));
const controls = Controls(document.querySelector('#controls'));
const windowSize = WindowSize(document.querySelector('#window-size'));

windowSize.addEventListener('resize-request', (evt) => {
  window.api.resizeWindow(evt.detail.w, evt.detail.h);
});

let gallery = null;
let isSwitching = false;
let currentRendering = window.args.initialRendering ?? null;
let sketchPath = window.args.sketchPath ?? null;
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
  if (hint)
    window.api.resizeWindow(Math.round(hint.w * 0.5), Math.round(hint.h * 0.5));

  sketchPath = newPath;
  window.api.setWatchSketch(newPath);
  controls.setSketchPath(newPath);

  const sketchName = newPath.split('/').pop().replace(/\.js$/, '');
  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    mode: engine.getMode(),
    galleryDir: galleryDir,
    galleryPaths: galleryPaths,
    canvasHint: engine.getCanvasHint(),
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

  window.api.onSettingsUpdate((_e, obj) => engine.updateParams(obj));

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
      sketchPath.split('/').pop().replace(/\.js$/, ''))
    : null;

  const initialHint = engine.getCanvasHint();
  if (initialHint)
    window.api.resizeWindow(
      Math.round(initialHint.w * 0.5),
      Math.round(initialHint.h * 0.5),
    );

  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    mode: engine.getMode(),
    canvasHint: engine.getCanvasHint(),
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
      mode: engine.getMode(),
      canvasHint: engine.getCanvasHint(),
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
        mode: engine.getMode(),
        canvasHint: engine.getCanvasHint(),
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
      engine.updateParams(result.params);
      const r = result.rendering;
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
      mode: engine.getMode(),
      galleryDir: galleryDir ?? null,
      galleryPaths: galleryPaths ?? null,
      galleryNames: galleryNames ?? null,
      canvasHint: engine.getCanvasHint(),
      initialRendering: currentRendering,
    });
  }

  // returning from a render reopens settings so the user lands back where they were
  if (window.args.openSettings) openSettings();

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
