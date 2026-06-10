import Loader from './components/loader.js';
import ErrorBar from './components/errorBar.js';
import Engine from '../../components/engine.js';
import Controls from './components/controls.js';
import WindowSize from './components/windowSize.js';
import { handleErrors } from '../error.js';

import eq from './sketches/eq.js';

const loader = Loader(document.querySelector('#loader'));
const errorBar = ErrorBar(document.querySelector('#error-bar'));
const engine = Engine(document.querySelector('#engine'));
const controls = Controls(document.querySelector('#controls'));
WindowSize(document.querySelector('#window-size'));

let gallery = null;
let isSwitching = false;
let sketchPath = window.args.sketchPath ?? null;

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
    previewDir: window.args.galleryDir + '/.mp5-previews',
    names: window.args.galleryNames ?? {},
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

  sketchPath = newPath;
  window.api.setWatchSketch(newPath);
  controls.setSketchPath(newPath);

  const sketchName = newPath.split('/').pop().replace(/\.js$/, '');
  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    mode: engine.getMode(),
    galleryDir: window.args.galleryDir,
    galleryPaths: window.args.galleryPaths,
  });
  pushGalleryState();

  engine.fadeIn();
  isSwitching = false;

  setTimeout(() => {
    const canvas = engine.getInstance()?.canvas;
    if (canvas) {
      window.api
        .saveSketchPreview(
          window.args.galleryDir,
          newPath,
          canvas.toDataURL('image/jpeg', 0.85),
        )
        .catch(() => {});
    }
  }, 500);
}

async function main() {
  handleErrors((msg) => {
    errorBar.setMessage(msg);
    errorBar.show();
  });

  controls.attach(engine);

  window.api.onSettingsUpdate((_e, obj) => engine.updateParams(obj));

  const { audioPath, initialParams } = window.args;

  if (window.args.galleryPaths?.length) {
    gallery = {
      paths: window.args.galleryPaths,
      currentIndex: 0,
      enabledPaths: new Set(window.args.galleryPaths),
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
    ? (window.args.galleryNames?.[sketchPath] ??
      window.args.sketchDisplayName ??
      sketchPath.split('/').pop().replace(/\.js$/, ''))
    : null;
  window.api.pushSettingsDefs({
    ...engine.getParamsDefinitions(),
    sketchName,
    mode: engine.getMode(),
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
    setTimeout(() => {
      const canvas = engine.getInstance()?.canvas;
      if (canvas) {
        window.api
          .saveSketchPreview(
            window.args.galleryDir,
            sketchPath,
            canvas.toDataURL('image/jpeg', 0.85),
          )
          .catch(() => {});
      }
    }, 500);
  }

  async function reloadSketch() {
    const newSketch = await importSketch(sketchPath, true);
    await engine.loadSketch(newSketch ?? eq);
    window.api.pushSettingsDefs({
      ...engine.getParamsDefinitions(),
      sketchName,
      mode: engine.getMode(),
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

  controls.addEventListener('sketch-pick', async (evt) => {
    sketchPath = evt.detail.path;
    sketchName = evt.detail.displayName;
    window.__sketchPath = sketchPath;
    const newSketch = await importSketch(sketchPath);
    if (newSketch) await engine.loadSketch(newSketch);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F12') {
      window.api.openSettings({
        ...(engine.getParamsDefinitions() ?? { groups: [], fields: [] }),
        sketchName,
        mode: engine.getMode(),
        galleryDir: window.args.galleryDir ?? null,
        galleryPaths: window.args.galleryPaths ?? null,
        galleryNames: window.args.galleryNames ?? null,
      });
    } else if (gallery && e.code === 'Tab') {
      e.preventDefault();
      e.shiftKey ? galleryPrev() : galleryNext();
    }
  });
}

main();
