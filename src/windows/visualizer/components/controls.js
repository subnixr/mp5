import Bar from './bar.js';
import { Label } from '../../../components/ui/inputs.js';
import OSD from '../../../components/ui/osd.js';

import sheet from './controls.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function withEvents(elem, obj) {
  Object.entries(obj).forEach(([k, cb]) => {
    elem?.addEventListener(k, cb);
  });
  return elem;
}

function Volume(elem) {
  const widget = elem.querySelector('.vol-widget');
  let dragging = false;

  elem.setLevel = (v) => {
    widget.style.setProperty('--vol-pct', v * 100 + '%');
  };

  function levelFromEvent(evt) {
    const rect = widget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
  }

  function emitLevel(evt) {
    elem.dispatchEvent(
      new CustomEvent('change', { detail: levelFromEvent(evt) }),
    );
  }

  elem.addEventListener('mousedown', (evt) => {
    if (evt.button !== 0) return;
    dragging = true;
    emitLevel(evt);
  });

  document.addEventListener('mousemove', (evt) => {
    if (dragging) emitLevel(evt);
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
  });

  return elem;
}

function Switch(elem) {
  const mic = Label(document.createElement('div'));
  mic.setAttribute('data-mic', '');
  mic.textContent = 'MIC';
  mic.addEventListener('click', () => {
    elem.dispatchEvent(new CustomEvent('mic'));
  });

  const file = Label(document.createElement('div'));
  file.setAttribute('data-file', '');
  file.textContent = 'FILE';
  file.addEventListener('click', () => {
    elem.dispatchEvent(new CustomEvent('file'));
  });

  elem.appendChild(mic);
  elem.appendChild(file);

  return elem;
}

export default function Controls(elem) {
  let engine = null;
  let bar = 'seek';
  let fullscreen = false;
  let oldVolume = 0;
  let sketchPath = window.args.sketchPath ?? null;
  let sketchDisplayName = window.args.sketchDisplayName ?? null;

  function mute() {
    oldVolume = engine?.getVolume();
    engine?.setVolume(0);
  }

  function unmute() {
    engine?.setVolume(oldVolume);
  }

  function toggleMute() {
    if (engine?.getVolume() === 0) {
      unmute();
    } else {
      mute();
    }
  }

  const dom = {
    play: withEvents(elem.querySelector('[data-play]'), {
      click: () => engine?.play(),
    }),
    pause: withEvents(elem.querySelector('[data-pause]'), {
      click: () => engine?.pause(),
    }),
    micOn: withEvents(elem.querySelector('[data-mic-on]'), {
      click: () => engine?.listen(false),
    }),
    micOff: withEvents(elem.querySelector('[data-mic-off]'), {
      click: () => engine?.listen(true),
    }),
    loop: withEvents(elem.querySelector('[data-loop]'), {
      click: () => engine?.loop(!engine?.getLoop()),
    }),
    fullscreen: withEvents(elem.querySelector('[data-fullscreen]'), {
      click: () => window.api.toggleFullscreen(),
    }),
    windowed: withEvents(elem.querySelector('[data-windowed]'), {
      click: () => window.api.toggleFullscreen(),
    }),
    vol: withEvents(Volume(elem.querySelector('[data-vol]')), {
      change: (evt) => {
        engine?.setVolume(evt.detail);
      },
      contextmenu: () => {
        toggleMute();
      },
    }),
    bar: withEvents(Bar(elem.querySelector('[data-bar]')), {
      contextmenu: (evt) => {
        evt.stopPropagation();
        if (engine?.getMode() === 'mic') return;
        bar = bar === 'seek' ? 'freq' : 'seek';
        updateDom();
      },
      seek: (evt) => {
        engine?.seek(evt.detail * engine.getDuration());
      },
    }),
    filename: withEvents(elem.querySelector('[data-filename]'), {
      click: () => {
        if (engine?.getMode() === 'file') window.api.showAudioInFolder();
      },
    }),
    inputSwitch: withEvents(Switch(elem.querySelector('[data-input-switch]')), {
      mic: () => {
        window.api.switchToMic();
        engine?.loadMic();
      },
      file: async () => {
        const filePath = await window.api.openAudioPicker();
        if (filePath) engine?.loadAudio(filePath);
      },
    }),
    trackLength: elem.querySelector('[data-track-length]'),
    param: withEvents(elem.querySelector('[data-param]'), {
      // let the visualizer open settings so it can include the rendering state
      // it owns; opening here would lose it and reset the render options
      click: () => elem.dispatchEvent(new CustomEvent('open-settings')),
    }),
    gallery: withEvents(elem.querySelector('[data-gallery]'), {
      click: () => window.api.openGallery(),
    }),
    sketch: withEvents(elem.querySelector('[data-sketch]'), {
      click: async () => {
        const picked = await window.api.openSketchPicker();
        if (picked) {
          sketchPath = picked.path;
          sketchDisplayName = picked.displayName;
          elem.dispatchEvent(
            new CustomEvent('sketch-pick', { detail: picked }),
          );
        }
      },
      contextmenu: (evt) => {
        evt.preventDefault();
        if (window.args.galleryDir) window.api.openGalleryDir();
        else if (sketchPath) window.api.openSketchInEditor(sketchPath);
      },
    }),
  };

  const osd = OSD(document.querySelector('[data-osd]'));
  const osdVol = withEvents(Volume(osd.querySelector('[data-osd-vol]')), {
    change: (evt) => {
      engine?.setVolume(evt.detail);
      showVolumeOSD(evt.detail);
    },
  });

  function showVolumeOSD(v) {
    osdVol.setLevel(v);
    osd.show(500);
  }

  function updateDom() {
    elem.setAttribute('data-fullscreen', fullscreen ? 'on' : 'off');

    const barMode = engine?.getMode() === 'mic' ? 'freq' : bar;
    elem.setAttribute('data-bar', barMode);
    dom.bar?.setMode(barMode);

    if (!engine) return;

    elem.setAttribute('data-mode', engine?.getMode());
    elem.setAttribute('data-listen', engine?.getListening() ? 'on' : 'off');
    elem.setAttribute('data-playback', engine?.getPlaying() ? 'play' : 'pause');
    elem.setAttribute('data-loop', engine?.getLoop() ? 'on' : 'off');

    dom.vol?.setLevel(engine?.getVolume());
    dom.filename?.replaceChildren(engine?.getAudioPath() || '');

    const dur = engine?.getDuration() ?? 0;
    dom.trackLength?.replaceChildren(dur ? formatTime(dur) : '');
  }

  function bindShortcuts() {
    document.addEventListener('keyup', (evt) => {
      evt.preventDefault();
      if (evt.ctrlKey && evt.code == 'Space') {
        elem.pin(!elem.classList.contains('pinned'));
      } else if (evt.code === 'Space') {
        if (engine?.getMode() === 'file') {
          engine?.getPlaying() ? engine?.pause() : engine?.play();
        } else {
          engine?.listen(!engine?.getListening());
        }
      } else if (evt.code === 'Enter') {
        window.api.toggleFullscreen();
      } else if (evt.code === 'ArrowLeft') {
        engine?.seek(engine?.getCurrentTime() - 10);
      } else if (evt.code === 'ArrowRight') {
        engine?.seek(engine?.getCurrentTime() + 10);
      } else if (evt.code === 'ArrowUp') {
        engine?.setVolume(engine?.getVolume() + 0.1);
      } else if (evt.code === 'ArrowDown') {
        engine?.setVolume(engine?.getVolume() - 0.1);
      } else if (evt.code === 'Home') {
        engine?.seek(0);
      } else if (evt.code === 'End') {
        engine?.seek(engine?.getDuration());
      } else if (evt.code === 'KeyM') {
        toggleMute();
        showVolumeOSD(engine?.getVolume() ?? 0);
      }
    });

    document.addEventListener(
      'wheel',
      (evt) => {
        const delta = evt.deltaY < 0 ? 0.05 : -0.05;
        const vol = Math.min(
          1,
          Math.max(0, (engine?.getVolume() ?? 0) + delta),
        );
        engine?.setVolume(vol);
        showVolumeOSD(vol);
      },
      { passive: true },
    );

    document.addEventListener('contextmenu', (evt) => {
      elem.pin(!elem.classList.contains('pinned'));
    });
  }

  function setupCursorHide() {
    let timeout;

    function showCursor() {
      document.body.style.cursor = '';
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        document.body.style.cursor = 'none';
      }, 3000);
    }

    document.addEventListener('mousemove', (e) => {
      if (elem.contains(e.target)) {
        clearTimeout(timeout);
        document.body.style.cursor = '';
        return;
      }
      showCursor();
    });

    showCursor();
  }

  elem.attach = (ng) => {
    engine = ng;
    engine.addEventListener('change', updateDom);
    dom.bar?.attach(ng);
    updateDom();
  };

  elem.setSketchPath = (p) => {
    sketchPath = p;
  };

  elem.pin = (toggle = true) => {
    elem.classList.toggle('pinned', toggle);
  };

  window.api.onFullscreenChange((_e, state) => {
    fullscreen = state;
    updateDom();
  });

  if (!window.args.sketchPath) {
    elem.pin();
  }

  if (window.args.galleryDir) {
    elem.setAttribute('data-gallery-mode', '');
  }

  bindShortcuts();
  setupCursorHide();
  elem.style.display = '';
  return elem;
}
