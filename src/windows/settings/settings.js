import Button from '../../components/ui/button.js';
import * as Input from '../../components/ui/inputs.js';
import FfmpegArgs from '../../components/ui/ffmpegArgs.js';

const FORMAT_PRESETS = {
  mp4: `-c:v libx264\n-pix_fmt yuv420p`,
  mov: `-c:v prores_ks\n-pix_fmt yuva444p10le`,
  webm: `-c:v libvpx-vp9\n-pix_fmt yuva420p\n-auto-alt-ref 0`,
};

const MIC_DEFAULT_LENGTH = '10';

function parseTimestamp(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.length > 3 || parts.some(isNaN)) return null;
  const [a, b, c] = parts;
  if (parts.length === 1) return a >= 0 ? a : null;
  if (parts.length === 2) return b >= 0 && b < 60 ? a * 60 + b : null;
  return b >= 0 && b < 60 && c >= 0 && c < 60 ? a * 3600 + b * 60 + c : null;
}

let currentDefs = window.api.definitions ?? { groups: [], fields: [] };

const panel = ParamsPanel(document.querySelector('#settings'));
const renderPanel = RenderingPanel(document.querySelector('#rendering'));

document.querySelectorAll('.btn').forEach(Button);

panel.build(currentDefs);

if (window.api.definitions.canvasHint) {
  const { w, h } = window.api.definitions.canvasHint;
  renderPanel.applyValues({ width: w, height: h });
}
if (window.api.definitions.initialRendering) {
  renderPanel.applyValues(window.api.definitions.initialRendering);
}

window.api.onDefinitionsChanged((defs) => {
  currentDefs = defs;
  panel.build(defs);
  if (defs.canvasHint)
    renderPanel.applyValues({
      width: defs.canvasHint.w,
      height: defs.canvasHint.h,
    });
});

document
  .querySelector('[data-action="save"]')
  .addEventListener('click', async () => {
    try {
      const values = panel.getValues();
      const rendering = renderPanel.getValues();
      await window.api.saveParams({ params: values, rendering });
    } catch (e) {
      console.error('saveParams failed:', e);
    }
  });

document
  .querySelector('[data-action="load"]')
  .addEventListener('click', async () => {
    try {
      const data = await window.api.loadParams();
      if (!data) return;
      const { rendering, params } = data;
      const sketchParams =
        params ??
        (() => {
          const { rendering: _, ...rest } = data;
          return rest;
        })();
      panel.applyValues(sketchParams);
      if (rendering) renderPanel.applyValues(rendering);
      if (rendering?.width && rendering?.height) {
        window.api.resizeWindow(
          Math.round(rendering.width * 0.5),
          Math.round(rendering.height * 0.5),
        );
      } else if (currentDefs.canvasHint) {
        const { w, h } = currentDefs.canvasHint;
        window.api.resizeWindow(Math.round(w * 0.5), Math.round(h * 0.5));
      }
    } catch (e) {
      console.error('loadParams failed:', e);
    }
  });

document
  .querySelector('[data-action="render"]')
  .addEventListener('click', async () => {
    const isMic = !currentDefs.audioBase;
    if (isMic) {
      const ok = confirm(
        'Rendering in mic mode: audio data will be zero.\n\nContinue?',
      );
      if (!ok) return;
    }

    const rv = renderPanel.getValues();
    const sketchName = currentDefs.sketchName ?? null;
    const audioBase = currentDefs.audioBase ?? null;
    const ext = renderPanel.getFormat();
    const parts = [sketchName, audioBase].filter(Boolean);
    const base = parts.length ? parts.join(' - ') + ' - ' : '';
    const defaultName = `${base}${rv.width}x${rv.height}@${rv.fps}.${ext}`;

    const output = await window.api.browseOutput(defaultName);
    if (!output) return;

    const startTime = rv.skip ? (parseTimestamp(rv.skip) ?? 0) : 0;
    const length = rv.length ? parseTimestamp(rv.length) : null;

    await window.api.triggerRender({
      params: panel.getValues(),
      rendering: {
        width: rv.width,
        height: rv.height,
        frameRate: rv.fps,
        startTime,
        length,
        ffmpegExtra: rv.ffmpegExtraArgs || null,
      },
      output,
    });
  });

function RenderingPanel(elem) {
  // Mic mode (no audio file) has no track duration to derive render length
  // from, so default the Length field to 10s the way the CLI requires -L.
  const isMic = !currentDefs.audioBase;

  function makeField(labelText, control) {
    const wrap = document.createElement('label');
    wrap.className = 'input';
    const lbl = document.createElement('span');
    lbl.className = 'label';
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    wrap.appendChild(control);
    return wrap;
  }

  const widthCtrl = Input.Number({ value: 1920, min: 1 });
  const heightCtrl = Input.Number({ value: 1080, min: 1 });
  const fpsCtrl = Input.Number({ value: 60, min: 1, max: 120 });

  const skipCtrl = Input.Text({ value: '' });
  const skipInput = skipCtrl.querySelector('input');
  skipInput.placeholder = '[[HH:]MM:]SS[.mmm]';
  skipInput.spellcheck = false;

  const lengthCtrl = Input.Text({ value: isMic ? MIC_DEFAULT_LENGTH : '' });
  const lengthInput = lengthCtrl.querySelector('input');
  lengthInput.placeholder = '[[HH:]MM:]SS[.mmm]';
  lengthInput.spellcheck = false;

  const formatCtrl = Input.Select({
    value: 'mov',
    options: ['mp4', 'mov', 'webm'],
  });
  const formatSelect = formatCtrl.querySelector('select');

  const ffmpegDiv = document.createElement('div');
  ffmpegDiv.id = 'ffmpeg-field';
  ffmpegDiv.className = 'rp-ffmpeg';
  const ffmpegComp = FfmpegArgs(ffmpegDiv);
  const ffmpegExtra = ffmpegComp.textarea;

  function syncFormatSelect(extraArgs) {
    const customOpt = formatSelect.querySelector('option[value="custom"]');
    const normalized = (extraArgs ?? '').trim();
    const match = Object.entries(FORMAT_PRESETS).find(
      ([, v]) => v === normalized,
    );
    if (match) {
      customOpt?.remove();
      formatSelect.value = match[0];
      ffmpegIsDefault = true;
    } else {
      if (!customOpt) {
        const opt = document.createElement('option');
        opt.value = 'custom';
        opt.textContent = 'custom';
        opt.disabled = true;
        formatSelect.insertBefore(opt, formatSelect.firstChild);
      }
      formatSelect.value = 'custom';
      ffmpegIsDefault = false;
    }
  }

  const row1 = document.createElement('div');
  row1.className = 'rp-row rp-row-3';
  row1.appendChild(makeField('Width', widthCtrl));
  row1.appendChild(makeField('Height', heightCtrl));
  row1.appendChild(makeField('FPS', fpsCtrl));

  const row2 = document.createElement('div');
  row2.className = 'rp-row rp-row-3';
  row2.appendChild(makeField('Skip', skipCtrl));
  row2.appendChild(makeField('Length', lengthCtrl));
  row2.appendChild(makeField('Format', formatCtrl));

  const group = Input.Group({
    title: 'rendering',
    open: true,
    noToggle: true,
    children: [row1, row2, ffmpegDiv],
  });
  elem.appendChild(group);

  ffmpegExtra.value = FORMAT_PRESETS[formatSelect.value];
  ffmpegComp.resizeTextarea();

  let ffmpegIsDefault = true;

  ffmpegExtra.addEventListener('input', () => {
    ffmpegIsDefault = ffmpegExtra.value === FORMAT_PRESETS[formatSelect.value];
  });

  formatCtrl.addEventListener('change', (e) => {
    formatSelect.querySelector('option[value="custom"]')?.remove();
    if (ffmpegIsDefault) {
      ffmpegExtra.value = FORMAT_PRESETS[e.detail];
      ffmpegIsDefault = true;
      ffmpegComp.resizeTextarea();
    }
    updatePreview();
  });

  function updatePreview() {
    const w = widthCtrl.getValue() || '?';
    const h = heightCtrl.getValue() || '?';
    const fps = fpsCtrl.getValue() || 60;
    const skipStr = skipCtrl.getValue().trim();
    const lenStr = lengthCtrl.getValue().trim();
    const skip = skipStr ? parseTimestamp(skipStr) : null;
    const length = lenStr ? parseTimestamp(lenStr) : null;
    const audio = currentDefs.audioBase ?? null;
    ffmpegComp.updateFixed({ w, h, fps, audio, skip, length, output: '' });
  }

  widthCtrl.addEventListener('change', updatePreview);
  heightCtrl.addEventListener('change', updatePreview);
  fpsCtrl.addEventListener('change', updatePreview);
  skipInput.addEventListener('input', updatePreview);
  lengthInput.addEventListener('input', updatePreview);

  updatePreview();

  elem.getValues = () => {
    const vals = {
      width: widthCtrl.getValue() || 1920,
      height: heightCtrl.getValue() || 1080,
      fps: fpsCtrl.getValue() || 60,
    };
    const skip = skipCtrl.getValue().trim();
    const len = lengthCtrl.getValue().trim();
    if (skip) vals.skip = skip;
    if (len) vals.length = len;
    const extra = ffmpegExtra.value.trim();
    if (extra) vals.ffmpegExtraArgs = extra;
    return vals;
  };

  elem.applyValues = (obj) => {
    if (!obj) return;
    if (obj.width != null) widthCtrl.setValue(obj.width);
    if (obj.height != null) heightCtrl.setValue(obj.height);
    if (obj.fps != null) fpsCtrl.setValue(obj.fps);
    skipCtrl.setValue(obj.skip ?? '');
    lengthCtrl.setValue(obj.length ?? (isMic ? MIC_DEFAULT_LENGTH : ''));
    if (obj.ffmpegExtraArgs != null) {
      ffmpegExtra.value = obj.ffmpegExtraArgs;
      syncFormatSelect(obj.ffmpegExtraArgs);
      ffmpegComp.resizeTextarea();
    }
    updatePreview();
  };

  elem.getFormat = () => formatSelect.value;

  return elem;
}

function ParamsPanel(elem) {
  const controls = new Map();

  function register(def) {
    const field = Input.Field(def, (key, value) =>
      window.api.updateParam(key, value),
    );
    controls.set(def.key, field);
    return field;
  }

  elem.build = (defs) => {
    elem.replaceChildren();
    controls.clear();

    const groups = defs.groups ?? [];
    const fields = defs.fields ?? [];

    if (groups.length + fields.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'settings-empty';
      empty.textContent = 'no params';
      elem.appendChild(empty);
      return;
    }

    for (const def of fields) {
      elem.appendChild(register(def));
    }

    for (const group of groups) {
      elem.appendChild(Input.Group(group, register));
    }
  };

  elem.getValues = () => {
    const values = {};
    for (const [key, field] of controls) values[key] = field.getValue();
    return values;
  };

  elem.applyValues = (obj) => {
    console.log(
      '[applyValues] obj keys:',
      Object.keys(obj),
      '| controls keys:',
      [...controls.keys()],
    );
    for (const [key, val] of Object.entries(obj)) {
      const field = controls.get(key);
      if (field) {
        console.log('[applyValues] setting', key, '=', val);
        field.setValue(val);
      }
    }
  };

  return elem;
}
