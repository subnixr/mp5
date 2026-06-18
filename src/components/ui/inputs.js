import sheet from './ui.css' with { type: 'css' };
if (!document.adoptedStyleSheets.includes(sheet)) {
  document.adoptedStyleSheets.push(sheet);
}

const FOCUSABLE = 'input, select, textarea, button, [tabindex]';

let keyboardNav = false;
let shiftNav = false;
document.addEventListener('keydown', (e) => { keyboardNav = true; shiftNav = e.shiftKey; });
document.addEventListener('mousedown', () => { keyboardNav = false; });

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

export function Label(elem) {
  elem.classList.add('label');
  return elem;
}

export function Number(field) {
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
      ? globalThis.Number(field.value ?? 0).toFixed(decimals)
      : (field.value ?? '');
  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
    emit(container, globalThis.Number(input.value));
  });
  container.appendChild(input);

  container.getValue = () => globalThis.Number(input.value);
  container.setValue = (v) => {
    input.value = decimals != null ? globalThis.Number(v).toFixed(decimals) : v;
    emit(container, globalThis.Number(v));
  };

  return container;
}

export function Text(field) {
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

export function Color(field) {
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

export function Checkbox(field) {
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

export function Select(field) {
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

export function File(field) {
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

export function Textarea(field) {
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
  if (def.type === 'number') return Number(def);
  if (def.type === 'text') return Text(def);
  if (def.type === 'color') return Color(def);
  if (def.type === 'checkbox') return Checkbox(def);
  if (def.type === 'select') return Select(def);
  if (def.type === 'file') return File(def);
  if (def.type === 'textarea') return Textarea(def);
  return Text(def);
}

export function Field(def, onChange) {
  const wrapper = document.createElement('label');
  wrapper.className = 'input';

  const span = Label(document.createElement('span'));
  span.textContent = def.label ?? def.key;
  wrapper.appendChild(span);

  const control = createControl(def);
  if (onChange) {
    control.addEventListener('change', (evt) => onChange(def.key, evt.detail));
  }
  wrapper.appendChild(control);

  wrapper.getValue = control.getValue;
  wrapper.setValue = control.setValue;

  return wrapper;
}

export function Group(def, register = null, depth = 0) {
  const details = document.createElement('details');
  details.className = 'group';
  details.open = def.open ?? (depth === 0);

  const summary = document.createElement('summary');
  summary.className = 'group-title';
  summary.textContent = def.title;
  if (def.noToggle) {
    details.dataset.noToggle = '';
    summary.addEventListener('click', (e) => e.preventDefault());
  }

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
  if (def.children) {
    for (const child of def.children) fieldsDiv.appendChild(child);
  } else {
    for (const item of def.items ?? []) {
      if ('key' in item) {
        fieldsDiv.appendChild(register(item));
      } else {
        fieldsDiv.appendChild(Group(item, register, depth + 1));
      }
    }
  }
  details.appendChild(fieldsDiv);

  return details;
}
