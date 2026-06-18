import Button from '../../components/button.js';

let keyboardNav = false;
let shiftNav = false;
document.addEventListener('keydown', (e) => { keyboardNav = true; shiftNav = e.shiftKey; });
document.addEventListener('mousedown', () => { keyboardNav = false; });

const FOCUSABLE = 'input, select, textarea, button, [tabindex]';

function firstFocusable(root) {
  for (const child of root.children) {
    if (child.tagName === 'DETAILS') {
      child.open = true;
      const found = firstFocusable(child);
      if (found) return found;
    } else if (child.matches(FOCUSABLE)) {
      return child;
    } else {
      const found = firstFocusable(child);
      if (found) return found;
    }
  }
  return null;
}

function lastFocusable(root) {
  for (const child of [...root.children].reverse()) {
    if (child.tagName === 'DETAILS') {
      child.open = true;
      const found = lastFocusable(child);
      if (found) return found;
    } else if (child.matches(FOCUSABLE)) {
      return child;
    } else {
      const found = lastFocusable(child);
      if (found) return found;
    }
  }
  return null;
}

function previousFocusable(details) {
  let sib = details.previousElementSibling;
  while (sib) {
    if (sib.tagName === 'DETAILS') sib.open = true;
    const last = lastFocusable(sib);
    if (last) return last;
    sib = sib.previousElementSibling;
  }
  return null;
}

function emit(elem, value) {
  elem.dispatchEvent(new CustomEvent('change', { detail: value }));
}

function NumberControl(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const decimals = field.decimals ?? null;

  const input = document.createElement('input');
  input.type = 'number';
  if (field.min != null) input.min = field.min;
  if (field.max != null) input.max = field.max;
  if (field.step != null) {
    input.step = field.step;
  } else if (decimals != null) {
    input.step = (10 ** -decimals).toFixed(decimals);
  }
  input.value =
    decimals != null
      ? Number(field.value ?? 0).toFixed(decimals)
      : (field.value ?? '');
  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, Number(input.value));
  });
  container.appendChild(input);

  container.getValue = () => Number(input.value);
  container.setValue = (v) => {
    input.value = decimals != null ? Number(v).toFixed(decimals) : v;
    emit(container, Number(v));
  };

  return container;
}

function TextControl(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = field.value ?? '';
  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, input.value);
  });
  container.appendChild(input);

  container.getValue = () => input.value;
  container.setValue = (v) => {
    input.value = v;
    emit(container, v);
  };

  return container;
}

function ColorControl(field) {
  const hasAlpha = field.transparency === true;
  const container = document.createElement('div');
  container.className = 'control color' + (hasAlpha ? ' has-alpha' : '');

  const initial = field.value ?? '#000000';
  const initHex = initial.slice(0, 7);
  const initAlpha = hasAlpha && initial.length === 9 ? parseInt(initial.slice(7, 9), 16) : 255;
  const initFull = hasAlpha ? initHex + initAlpha.toString(16).padStart(2, '0') : initHex;

  container.style.setProperty('--color', initFull);
  if (hasAlpha) container.style.setProperty('--color-rgb', initHex);

  const row = document.createElement('div');
  row.className = 'color-row';

  const text = document.createElement('input');
  text.type = 'text';
  text.value = initFull;

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = initHex;
  picker.tabIndex = -1;

  let alpha = null;
  if (hasAlpha) {
    alpha = document.createElement('input');
    alpha.type = 'range';
    alpha.min = 0;
    alpha.max = 255;
    alpha.value = initAlpha;
  }

  function buildValue() {
    if (!hasAlpha) return picker.value;
    return picker.value + parseInt(alpha.value).toString(16).padStart(2, '0');
  }

  function syncDisplay() {
    const val = buildValue();
    container.style.setProperty('--color', val);
    if (hasAlpha) container.style.setProperty('--color-rgb', picker.value);
    text.value = val;
  }

  picker.addEventListener('input', syncDisplay);
  picker.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, buildValue());
  });

  text.addEventListener('change', (evt) => {
    evt.stopPropagation();
    const v = text.value.trim();
    const pattern = hasAlpha ? /^#[0-9a-f]{8}$/i : /^#[0-9a-f]{6}$/i;
    if (pattern.test(v)) {
      picker.value = v.slice(0, 7);
      if (hasAlpha) alpha.value = parseInt(v.slice(7, 9), 16);
      container.style.setProperty('--color', v);
      if (hasAlpha) container.style.setProperty('--color-rgb', picker.value);
      emit(container, buildValue());
    }
  });

  if (alpha) {
    alpha.addEventListener('input', syncDisplay);
    alpha.addEventListener('change', (evt) => {
      evt.stopPropagation();
      emit(container, buildValue());
    });
  }

  row.appendChild(text);
  row.appendChild(picker);
  container.appendChild(row);
  if (alpha) container.appendChild(alpha);

  container.getValue = () => buildValue();
  container.setValue = (v) => {
    const hex = v.slice(0, 7);
    picker.value = hex;
    if (hasAlpha) {
      const a = v.length === 9 ? parseInt(v.slice(7, 9), 16) : 255;
      alpha.value = a;
      const full = hex + a.toString(16).padStart(2, '0');
      container.style.setProperty('--color', full);
      container.style.setProperty('--color-rgb', hex);
      text.value = full;
    } else {
      container.style.setProperty('--color', hex);
      text.value = hex;
    }
    emit(container, buildValue());
  };

  return container;
}

function CheckboxControl(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = field.value ?? false;
  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, input.checked);
  });
  container.appendChild(input);

  container.getValue = () => input.checked;
  container.setValue = (v) => {
    input.checked = v;
    emit(container, v);
  };

  return container;
}

function SelectControl(field) {
  const container = document.createElement('div');
  container.className = 'control select';

  const select = document.createElement('select');
  for (const opt of field.options ?? []) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === field.value) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, select.value);
  });
  container.appendChild(select);

  container.getValue = () => select.value;
  container.setValue = (v) => {
    select.value = v;
    emit(container, v);
  };

  return container;
}

function FileControl(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const btn = document.createElement('div');
  btn.className = 'file-btn';
  btn.tabIndex = 0;
  btn.textContent = field.value ? field.value.split('/').pop() : '…';

  let currentPath = field.value ?? null;

  btn.addEventListener('click', async () => {
    const result = await window.api.requestFile(field.key);
    if (result?.path) {
      currentPath = result.path;
      btn.textContent = result.path.split('/').pop();
      emit(container, result.path);
    }
  });
  container.appendChild(btn);

  container.getValue = () => currentPath;
  container.setValue = (v) => {
    currentPath = v;
    btn.textContent = v ? v.split('/').pop() : '…';
    emit(container, v);
  };

  return container;
}

function TextareaControl(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const textarea = document.createElement('textarea');
  textarea.value = field.value ?? '';
  textarea.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, textarea.value);
  });
  container.appendChild(textarea);

  container.getValue = () => textarea.value;
  container.setValue = (v) => {
    textarea.value = v;
    emit(container, v);
  };

  return container;
}

function createControl(def) {
  if (def.type === 'number') return NumberControl(def);
  if (def.type === 'text') return TextControl(def);
  if (def.type === 'color') return ColorControl(def);
  if (def.type === 'checkbox') return CheckboxControl(def);
  if (def.type === 'select') return SelectControl(def);
  if (def.type === 'file') return FileControl(def);
  if (def.type === 'textarea') return TextareaControl(def);
  return TextControl(def);
}

function Field(def) {
  const label = document.createElement('label');
  label.className = 'input';

  const span = document.createElement('span');
  span.className = 'label';
  span.textContent = def.label ?? def.key;
  label.appendChild(span);

  const control = createControl(def);
  control.addEventListener('change', (evt) =>
    window.api.updateParam(def.key, evt.detail),
  );
  label.appendChild(control);

  label.getValue = control.getValue;
  label.setValue = control.setValue;

  return label;
}

function Group(def, register, depth = 0) {
  const details = document.createElement('details');
  details.className = 'group';
  details.open = depth === 0;

  const summary = document.createElement('summary');
  summary.className = 'group-title';
  summary.textContent = def.title;
  summary.addEventListener('focus', () => {
    if (!keyboardNav) return;
    if (shiftNav) {
      const prev = previousFocusable(details);
      if (prev) prev.focus();
      return;
    }
    details.open = true;
    const first = firstFocusable(fieldsDiv);
    if (first) first.focus();
  });
  details.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    details.open = true;
    for (const sib of details.parentElement.children) {
      if (sib !== details && sib.tagName === 'DETAILS') sib.open = false;
    }
  });
  details.appendChild(summary);

  const fieldsDiv = document.createElement('div');
  fieldsDiv.className = 'group-fields';
  for (const item of def.items ?? []) {
    if ('key' in item) {
      fieldsDiv.appendChild(register(item));
    } else {
      fieldsDiv.appendChild(Group(item, register, depth + 1));
    }
  }
  details.appendChild(fieldsDiv);

  return details;
}

function SketchCard(filePath, name, enabled, previewDir) {
  const card = document.createElement('div');
  card.className = 'sketch-card';

  const img = document.createElement('img');
  img.className = 'card-preview';
  img.src = `file://${previewDir}/${name}.jpg`;
  img.alt = '';
  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
  card.appendChild(img);

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = name;
  card.appendChild(title);

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card-check';
  check.checked = enabled;
  card.appendChild(check);

  card.addEventListener('click', (evt) => {
    if (evt.target === check) return;
    window.api.updateGallerySettings({ switchToPath: filePath });
  });

  card.getEnabled = () => check.checked;
  card.setEnabled = (v) => {
    check.checked = v;
  };
  card.filePath = filePath;
  return card;
}

function GalleryPanel(elem) {
  const controls = document.createElement('div');
  controls.className = 'gallery-controls';

  const shuffleLabel = document.createElement('label');
  shuffleLabel.className = 'input';
  const shuffleSpan = document.createElement('span');
  shuffleSpan.className = 'label';
  shuffleSpan.textContent = 'Shuffle';
  const shuffleCheck = document.createElement('input');
  shuffleCheck.type = 'checkbox';
  shuffleCheck.addEventListener('change', () =>
    window.api.updateGallerySettings({ shuffle: shuffleCheck.checked }),
  );
  shuffleLabel.append(shuffleSpan, shuffleCheck);
  controls.appendChild(shuffleLabel);

  const autoplayLabel = document.createElement('label');
  autoplayLabel.className = 'input';
  const autoplaySpan = document.createElement('span');
  autoplaySpan.className = 'label';
  autoplaySpan.textContent = 'Autoplay (s)';
  const autoplayInput = document.createElement('input');
  autoplayInput.type = 'number';
  autoplayInput.min = 0;
  autoplayInput.step = 1;
  autoplayInput.value = 0;
  autoplayInput.addEventListener('change', () =>
    window.api.updateGallerySettings({ autoplay: Number(autoplayInput.value) }),
  );
  autoplayLabel.append(autoplaySpan, autoplayInput);
  controls.appendChild(autoplayLabel);

  const grid = document.createElement('div');
  grid.className = 'sketch-grid';
  elem.appendChild(grid);

  elem.appendChild(controls);

  let cards = [];

  function emitEnabledPaths() {
    window.api.updateGallerySettings({
      enabledPaths: cards.filter((c) => c.getEnabled()).map((c) => c.filePath),
    });
  }

  elem.applyState = (state) => {
    shuffleCheck.checked = state.shuffle ?? false;
    autoplayInput.value = state.autoplay ?? 0;

    const enabledSet = new Set(state.enabledPaths ?? state.paths ?? []);
    grid.replaceChildren();
    cards = (state.paths ?? []).map((p) => {
      const name = state.names?.[p] ?? p.split('/').pop().replace(/\.js$/, '');
      const card = SketchCard(p, name, enabledSet.has(p), state.previewDir);
      card
        .querySelector('.card-check')
        .addEventListener('change', emitEnabledPaths);
      grid.appendChild(card);
      return card;
    });
  };

  return elem;
}

function ParamsPanel(elem) {
  const controls = new Map();

  function register(def) {
    const field = Field(def);
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
      empty.textContent = 'no settings';
      elem.appendChild(empty);
      return;
    }

    for (const def of fields) {
      elem.appendChild(register(def));
    }

    for (const group of groups) {
      elem.appendChild(Group(group, register));
    }
  };

  elem.getValues = () => {
    const values = {};
    for (const [key, field] of controls) values[key] = field.getValue();
    return values;
  };

  elem.applyValues = (obj) => {
    for (const [key, val] of Object.entries(obj)) {
      controls.get(key)?.setValue(val);
    }
  };

  return elem;
}

const panel = ParamsPanel(document.querySelector('#settings'));
const renderBtn = document.querySelector('[data-action="render"]');

document.querySelectorAll('.action-btn').forEach(Button);

panel.build(window.api.definitions ?? { groups: [], fields: [] });

window.api.onDefinitionsChanged((defs) => {
  panel.build(defs);
});

let galleryPanel = null;

window.api.onGalleryStatePush((state) => {
  if (!galleryPanel) {
    galleryPanel = GalleryPanel(document.getElementById('gallery-panel'));
    document.getElementById('gallery-panel').style.display = '';
    setupLayout();
  }
  galleryPanel.applyState(state);
});

function setupLayout() {
  const tabBar = document.getElementById('tab-bar');
  const paramsPanel = document.getElementById('params-panel');
  const gPanel = document.getElementById('gallery-panel');

  function applyLayout() {
    const wide = window.innerWidth >= 840;
    tabBar.style.display = wide ? 'none' : 'flex';
    if (wide) {
      paramsPanel.style.display = '';
      gPanel.style.display = '';
    } else {
      const activeTab =
        tabBar.querySelector('.tab-btn.active')?.dataset.tab ?? 'params';
      paramsPanel.style.display = activeTab === 'params' ? '' : 'none';
      gPanel.style.display = activeTab === 'gallery' ? '' : 'none';
    }
  }

  tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBar
        .querySelectorAll('.tab-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyLayout();
    });
  });

  new ResizeObserver(applyLayout).observe(document.body);
  applyLayout();
}

document
  .querySelector('[data-action="save"]')
  .addEventListener('click', async () => {
    try {
      await window.api.saveParams(panel.getValues());
    } catch (e) {
      console.error('saveParams failed:', e);
    }
  });

document
  .querySelector('[data-action="load"]')
  .addEventListener('click', async () => {
    try {
      const values = await window.api.loadParams();
      if (values) panel.applyValues(values);
    } catch (e) {
      console.error('loadParams failed:', e);
    }
  });

renderBtn.addEventListener('click', async () => {
  await window.api.triggerRender(panel.getValues());
});
