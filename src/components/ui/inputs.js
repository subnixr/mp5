import sheet from './ui.css' with { type: 'css' };
if (!document.adoptedStyleSheets.includes(sheet)) {
  document.adoptedStyleSheets.push(sheet);
}

const FOCUSABLE = 'input, select, textarea, button, [tabindex]';

let keyboardNav = false;
let shiftNav = false;
document.addEventListener('keydown', (e) => {
  keyboardNav = true;
  shiftNav = e.shiftKey;
});
document.addEventListener('mousedown', () => {
  keyboardNav = false;
});

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

function emit(elem, value) {
  elem.dispatchEvent(new CustomEvent('change', { detail: value }));
}

function iconSpan(id) {
  const span = document.createElement('span');
  span.className = 'action-icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  span.appendChild(svg);
  return span;
}

let _tipPopup = null;
let _tipAnchor = null;

function getTipPopup() {
  if (!_tipPopup) {
    _tipPopup = document.createElement('div');
    _tipPopup.className = 'tip-popup';
    _tipPopup.style.display = 'none';
    document.body.appendChild(_tipPopup);
  }
  return _tipPopup;
}

function showTip(anchor, text) {
  const popup = getTipPopup();
  _tipAnchor = anchor;
  popup.replaceChildren();
  for (const line of text.split('\n')) {
    const p = document.createElement('p');
    p.textContent = line;
    popup.appendChild(p);
  }
  popup.style.display = '';
  const rect = anchor.getBoundingClientRect();
  const popupW = popup.offsetWidth;
  const popupH = popup.offsetHeight;
  const iconCenterX = rect.left + rect.width / 2;
  const left = Math.max(4, Math.min(iconCenterX - popupW / 2, window.innerWidth - popupW - 4));
  popup.style.left = left + 'px';
  popup.style.setProperty('--tip-arrow-x', (iconCenterX - left - 6) + 'px');
  const goDown = window.innerHeight - rect.bottom >= popupH + 4;
  if (goDown) {
    popup.style.top = rect.bottom + 4 + 'px';
    popup.style.bottom = '';
  } else {
    popup.style.top = '';
    popup.style.bottom = window.innerHeight - rect.top + 4 + 'px';
  }
  popup.dataset.popupDir = goDown ? 'down' : 'up';
}

function hideTip(anchor) {
  if (_tipAnchor === anchor) {
    getTipPopup().style.display = 'none';
    _tipAnchor = null;
  }
}

export function Tooltip(anchor, text) {
  anchor.addEventListener('click', (e) => {
    e.stopPropagation();
    _tipAnchor === anchor && _tipPopup?.style.display !== 'none' ? hideTip(anchor) : showTip(anchor, text);
  });
  anchor.addEventListener('mouseenter', () => showTip(anchor, text));
  anchor.addEventListener('mouseleave', () => hideTip(anchor));
}

function makeTipIcon(tip) {
  const icon = iconSpan('info');
  icon.classList.add('tip-icon');
  Tooltip(icon, tip);
  return icon;
}

export function Label(
  elem,
  { collapsible = false, group = false, label, open = true, onExpand, tip } = {},
) {
  if (group) {
    elem.classList.add('group-title');
    if (label != null) elem.textContent = label;
    return elem;
  }

  if (!collapsible) {
    elem.classList.add('label');
    if (tip != null) {
      const textSpan = document.createElement('span');
      if (label != null) textSpan.textContent = label;
      elem.appendChild(textSpan);
      elem.appendChild(makeTipIcon(tip));
      elem.classList.add('has-tip');
    } else {
      if (label != null) elem.textContent = label;
    }
    return elem;
  }

  elem.classList.add('label-header');

  const chevron = document.createElement('span');
  chevron.className = 'label-chevron';

  const span = document.createElement('span');
  span.className = 'label';
  if (label != null) span.textContent = label;

  elem.appendChild(span);
  elem.appendChild(chevron);
  if (tip != null) elem.appendChild(makeTipIcon(tip));

  let target = null;
  let expanded = open;

  function setExpanded(val) {
    expanded = val;
    if (expanded) {
      elem.dataset.expanded = '';
    } else {
      delete elem.dataset.expanded;
    }
    if (target) target.style.display = expanded ? '' : 'none';
    if (expanded && onExpand) onExpand();
  }

  elem.setTarget = (t) => {
    target = t;
    setExpanded(expanded);
  };
  elem.setExpanded = setExpanded;

  elem.addEventListener('click', () => setExpanded(!expanded));
  setExpanded(open);

  return elem;
}

export function Number(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const decimals = field.decimals ?? null;
  const step = field.step ?? (decimals != null ? 10 ** -decimals : 1);

  const fmt = (v) =>
    decimals != null ? globalThis.Number(v).toFixed(decimals) : String(v);

  const clamp = (v) => {
    if (field.min != null) v = Math.max(field.min, v);
    if (field.max != null) v = Math.min(field.max, v);
    return v;
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.value = fmt(field.value ?? 0);

  let lastValid = input.value;

  input.addEventListener('input', () => {
    if (/^-?\d*\.?\d*$/.test(input.value)) {
      lastValid = input.value;
    } else {
      input.value = lastValid;
    }
  });

  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
  });

  input.addEventListener('blur', () => {
    const parsed = parseFloat(input.value);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      input.value = fmt(clamped);
      lastValid = input.value;
      emit(container, clamped);
    } else {
      input.value = lastValid;
    }
  });

  const nudge = (delta) => {
    const v = clamp(globalThis.Number(input.value) + delta);
    input.value = fmt(v);
    lastValid = input.value;
    emit(container, v);
  };

  input.addEventListener('keydown', (evt) => {
    if (evt.key === 'ArrowUp') { evt.preventDefault(); nudge(+step); }
    else if (evt.key === 'ArrowDown') { evt.preventDefault(); nudge(-step); }
  });

  container.appendChild(input);

  if (field.unit != null) {
    container.classList.add('has-unit');
    const unitBox = document.createElement('div');
    unitBox.className = 'unit-box';
    unitBox.textContent = field.unit;

    unitBox.addEventListener('click', (evt) => {
      evt.preventDefault();
      nudge(+step);
    });
    unitBox.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      nudge(-step);
    });

    container.appendChild(unitBox);
  }

  container.getValue = () => globalThis.Number(input.value);
  container.setValue = (v) => {
    input.value = fmt(v);
    lastValid = input.value;
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
  });
  input.addEventListener('input', () => {
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
  const initAlpha =
    hasAlpha && initial.length === 9 ? parseInt(initial.slice(7, 9), 16) : 255;
  const initFull = hasAlpha
    ? initHex + initAlpha.toString(16).padStart(2, '0')
    : initHex;

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

  const clearBtn = document.createElement('div');
  clearBtn.className = 'file-clear';
  clearBtn.tabIndex = 0;
  clearBtn.appendChild(iconSpan('remove'));

  let currentPath = field.value ?? null;

  function update(path) {
    currentPath = path;
    btn.textContent = path ? path.split('/').pop() : '';
    container.classList.toggle('has-value', !!path);
  }

  btn.addEventListener('click', async () => {
    const result = await window.api.requestFile(field.key);
    if (result?.path) {
      update(result.path);
      emit(container, result.path);
    }
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    update(null);
    emit(container, null);
  });

  clearBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      update(null);
      emit(container, null);
    }
  });

  container.appendChild(btn);
  container.appendChild(clearBtn);

  update(currentPath);

  container.getValue = () => currentPath;
  container.setValue = (v) => {
    update(v);
    emit(container, v);
  };

  return container;
}

export function Image(field) {
  const container = document.createElement('div');
  container.className = 'control';

  const btn = document.createElement('div');
  btn.className = 'file-btn';
  btn.tabIndex = 0;

  const clearBtn = document.createElement('div');
  clearBtn.className = 'file-clear';
  clearBtn.tabIndex = 0;
  clearBtn.appendChild(iconSpan('remove'));

  const previewBtn = document.createElement('div');
  previewBtn.className = 'image-preview-btn';
  previewBtn.tabIndex = 0;
  previewBtn.appendChild(iconSpan('image'));

  let currentPath = field.value ?? null;

  function update(path) {
    currentPath = path;
    btn.textContent = path ? path.split('/').pop() : '';
    container.classList.toggle('has-value', !!path);
  }

  async function pickFile() {
    const result = await window.api.requestFile(field.key);
    if (result?.path) {
      update(result.path);
      emit(container, result.path);
    }
  }

  btn.addEventListener('click', pickFile);

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    update(null);
    emit(container, null);
  });

  clearBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      update(null);
      emit(container, null);
    }
  });

  previewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentPath) window.api.openFile(currentPath);
    else pickFile();
  });

  previewBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (currentPath) window.api.openFile(currentPath);
      else pickFile();
    }
  });

  container.appendChild(btn);
  container.appendChild(clearBtn);
  container.appendChild(previewBtn);

  update(currentPath);

  container.getValue = () => currentPath;
  container.setValue = (v) => {
    update(v);
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

export function Repeater(def) {
  const { min = 0, max = null, itemDef = {}, key } = def;
  let values = Array.isArray(def.value) ? [...def.value] : [];
  while (values.length < min) values.push(itemDef.value ?? null);

  const container = document.createElement('div');
  container.className = 'repeater';

  const header = Label(document.createElement('div'), {
    collapsible: true,
    label: def.label ?? key,
    open: true,
    tip: def.tip,
  });

  const body = document.createElement('div');
  body.className = 'repeater-body';

  header.setTarget(body);

  function syncTabIndex() {
    header.tabIndex = 'expanded' in header.dataset ? -1 : 0;
  }
  new MutationObserver(syncTabIndex).observe(header, {
    attributes: true,
    attributeFilter: ['data-expanded'],
  });
  syncTabIndex();

  function focusableInBody() {
    return Array.from(
      body.querySelectorAll(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  header.addEventListener('focus', () => {
    if (!keyboardNav) return;
    header.setExpanded(true);
    requestAnimationFrame(() => {
      const targets = focusableInBody();
      if (!targets.length) return;
      (shiftNav ? targets[targets.length - 1] : targets[0]).focus();
    });
  });

  function render() {
    body.replaceChildren();

    let dragIndex = null;

    values.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'repeater-row';

      const handle = document.createElement('div');
      handle.className = 'repeater-handle';
      handle.appendChild(iconSpan('drag'));
      handle.addEventListener('mousedown', () => {
        row.draggable = true;
      });
      row.addEventListener('dragend', () => {
        row.draggable = false;
        dragIndex = null;
      });
      row.addEventListener('dragstart', (e) => {
        dragIndex = i;
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragover', (e) => {
        if (dragIndex === null || dragIndex === i) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', (e) => {
        if (dragIndex === null || dragIndex === i) return;
        e.preventDefault();
        const [moved] = values.splice(dragIndex, 1);
        values.splice(i, 0, moved);
        render();
        emit(container, [...values]);
      });
      row.appendChild(handle);

      const field = Field(
        { ...itemDef, label: false, key: `${key}[${i}]`, value: v },
        (_, val) => {
          values[i] = val;
          emit(container, [...values]);
        },
      );
      row.appendChild(field);

      const rmBtn = document.createElement('button');
      rmBtn.className = 'btn repeater-remove';
      rmBtn.appendChild(iconSpan('remove'));
      if (i >= min) {
        rmBtn.addEventListener('click', () => {
          values.splice(i, 1);
          render();
          emit(container, [...values]);
        });
      } else {
        rmBtn.disabled = true;
      }
      row.appendChild(rmBtn);

      body.appendChild(row);
    });

    if (max === null || values.length < max) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn repeater-add';
      addBtn.appendChild(iconSpan('insert'));
      addBtn.addEventListener('click', () => {
        values.push(itemDef.value ?? null);
        render();
        emit(container, [...values]);
      });
      body.appendChild(addBtn);
    }
  }

  render();

  container.appendChild(header);
  container.appendChild(body);

  container.getValue = () => [...values];
  container.setValue = (v) => {
    if (!Array.isArray(v)) return;
    values = [...v];
    while (values.length < min) values.push(itemDef.value ?? null);
    render();
  };

  return container;
}

export function Combo(def, onSubChange) {
  const container = document.createElement('div');
  container.className = 'combo';

  if (def.label !== false) {
    const labelSpan = Label(document.createElement('span'), { label: def.label ?? def.key ?? '', tip: def.tip });
    container.appendChild(labelSpan);
  }

  const row = document.createElement('div');
  row.className = 'combo-row';

  const controls = [];
  const values = {};
  const rowValue =
    def.value != null &&
    typeof def.value === 'object' &&
    !Array.isArray(def.value)
      ? def.value
      : {};

  for (const itemDef of def.items ?? []) {
    const itemValue =
      itemDef.key in rowValue ? rowValue[itemDef.key] : itemDef.value;
    const ctrl = createControl({ ...itemDef, value: itemValue });
    if (itemDef.flex != null)
      ctrl.style.flex =
        itemDef.flex === 'auto' ? '0 1 auto' : String(itemDef.flex);
    ctrl.style.minWidth = '0';
    values[itemDef.key] = ctrl.getValue();

    ctrl.addEventListener('change', (evt) => {
      evt.stopPropagation();
      values[itemDef.key] = evt.detail;
      if (onSubChange) onSubChange(itemDef.paramKey ?? itemDef.key, evt.detail);
      emit(container, { ...values });
    });

    controls.push({ key: itemDef.key, ctrl });
    row.appendChild(ctrl);
  }

  container.appendChild(row);

  container.getValue = () => ({ ...values });
  container.setValue = (v) => {
    if (typeof v !== 'object' || v === null) return;
    for (const { key, ctrl } of controls) {
      if (key in v) {
        ctrl.setValue(v[key]);
        values[key] = v[key];
      }
    }
    emit(container, { ...values });
  };

  return container;
}

export function Grid(def, onSubChange) {
  const container = document.createElement('div');
  container.className = 'grid-fields';
  container.style.setProperty('--grid-cols', String(def.columns ?? 1));

  const controls = [];
  const values = {};
  const rowValue =
    def.value != null &&
    typeof def.value === 'object' &&
    !Array.isArray(def.value)
      ? def.value
      : {};

  for (const itemDef of def.items ?? []) {
    const itemValue =
      itemDef.key in rowValue ? rowValue[itemDef.key] : itemDef.value;
    const field = Field({ ...itemDef, value: itemValue }, (key, val) => {
      values[key] = val;
      if (onSubChange) onSubChange(itemDef.paramKey ?? key, val);
      emit(container, { ...values });
    });
    if (itemDef.span != null) field.style.gridColumn = `span ${itemDef.span}`;
    values[itemDef.key] = field.getValue();
    controls.push({ key: itemDef.key, field });
    container.appendChild(field);
  }

  container.getValue = () => ({ ...values });
  container.setValue = (v) => {
    if (typeof v !== 'object' || v === null) return;
    for (const { key, field } of controls) {
      if (key in v) {
        field.setValue(v[key]);
        values[key] = v[key];
      }
    }
    emit(container, { ...values });
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
  if (def.type === 'image') return Image(def);
  if (def.type === 'textarea') return Textarea(def);
  if (def.type === 'time') return Time(def);
  if (def.type === 'timerange') return TimeRange(def);
  if (def.type === 'repeater') return Repeater(def);
  if (def.type === 'combo') return Combo(def);
  if (def.type === 'grid') return Grid(def);
  return Text(def);
}

export function Field(def, onChange) {
  let elem;

  if (def.type === 'repeater') {
    const ctrl = Repeater(def);
    if (onChange) {
      ctrl.addEventListener('change', (evt) => onChange(def.key, evt.detail));
    }
    elem = ctrl;
  } else if (def.type === 'combo') {
    if (def.label === false) {
      // Row inside a repeater: emit composite value
      const ctrl = Combo(def);
      if (onChange)
        ctrl.addEventListener('change', (evt) => onChange(def.key, evt.detail));
      elem = ctrl;
    } else {
      // Standalone combo: emit per sub-key
      elem = Combo(
        def,
        onChange ? (subKey, val) => onChange(subKey, val) : null,
      );
    }
  } else if (def.type === 'grid') {
    if (def.label === false) {
      // Grid inside a repeater: emit composite value
      const ctrl = Grid(def);
      if (onChange)
        ctrl.addEventListener('change', (evt) => onChange(def.key, evt.detail));
      elem = ctrl;
    } else {
      // Standalone grid: emit per sub-key
      elem = Grid(
        def,
        onChange ? (subKey, val) => onChange(subKey, val) : null,
      );
    }
  } else {
    const wrapper = document.createElement('label');
    wrapper.className = 'input';
    wrapper.tabIndex = -1;

    const control = createControl(def);
    if (onChange) {
      control.addEventListener('change', (evt) =>
        onChange(def.key, evt.detail),
      );
    }

    if (def.label !== false) {
      if (def.type === 'checkbox') {
        const span = Label(document.createElement('span'), { label: def.label ?? def.key });
        if (!def.checkboxLeft) {
          wrapper.appendChild(span);
          wrapper.appendChild(control);
        } else {
          wrapper.appendChild(control);
          wrapper.appendChild(span);
        }
        if (def.tip != null) wrapper.appendChild(makeTipIcon(def.tip));
      } else {
        const span = Label(document.createElement('span'), { label: def.label ?? def.key, tip: def.tip });
        wrapper.appendChild(span);
        wrapper.appendChild(control);
      }
    } else {
      wrapper.appendChild(control);
    }

    wrapper.getValue = control.getValue;
    wrapper.setValue = control.setValue;
    elem = wrapper;
  }

  elem.setVisible = (v) => {
    elem.style.display = v ? '' : 'none';
  };
  if (def.disabledValue) elem.style.display = 'none';

  return elem;
}

export function Group(def, register = null, depth = 0) {
  const details = document.createElement('details');
  details.className = 'group';
  details.open = def.open ?? depth === 0;

  const summary = Label(document.createElement('summary'), {
    group: true,
    label: def.title,
  });
  if (def.noToggle) {
    details.dataset.noToggle = '';
    summary.addEventListener('click', (e) => e.preventDefault());
    summary.tabIndex = -1;
  }

  function syncSummaryTabIndex() {
    summary.tabIndex = details.open ? -1 : 0;
  }
  if (!def.noToggle) {
    syncSummaryTabIndex();
    details.addEventListener('toggle', syncSummaryTabIndex);
  }

  summary.addEventListener('focus', () => {
    if (!keyboardNav) return;
    details.open = true;
    const target = shiftNav
      ? lastFocusable(fieldsDiv)
      : firstFocusable(fieldsDiv);
    if (target) target.focus();
  });
  summary.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    details.open = true;
    for (const sib of details.parentElement.children) {
      if (sib !== details && sib.tagName === 'DETAILS') sib.open = false;
    }
  });
  details.appendChild(summary);

  if (def.tip != null) {
    const tipWrapper = document.createElement('div');
    tipWrapper.className = 'group-tip';
    tipWrapper.appendChild(makeTipIcon(def.tip));
    details.appendChild(tipWrapper);
  }

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

  details.setVisible = (v) => {
    details.style.display = v ? '' : 'none';
  };
  if (def.disabledValue) details.style.display = 'none';

  return details;
}

function positionPopup(anchor, popup) {
  const rect = anchor.getBoundingClientRect();
  const popupHeight = popup.offsetHeight;
  const goDown = (window.innerHeight - rect.bottom) >= popupHeight;
  popup.style.position = 'fixed';
  popup.style.width = rect.width + 'px';
  popup.style.left = rect.left + 'px';
  if (goDown) {
    popup.style.top = rect.bottom + 'px';
    popup.style.bottom = '';
  } else {
    popup.style.top = '';
    popup.style.bottom = (window.innerHeight - rect.top) + 'px';
  }
  popup.dataset.popupDir = goDown ? 'down' : 'up';
}

function parseTimecodeStr(str) {
  str = str.trim();
  const neg = str.startsWith('-');
  if (neg) str = str.slice(1);
  const parts = str.split(':').map(globalThis.Number);
  if (parts.length > 3 || parts.some((p) => isNaN(p) || p < 0)) return null;
  const [a, b, c] = parts;
  let s;
  if (parts.length === 1) s = a;
  else if (parts.length === 2) {
    if (b >= 60) return null;
    s = a * 60 + b;
  } else {
    if (b >= 60 || c >= 60) return null;
    s = a * 3600 + b * 60 + c;
  }
  return neg ? -s : s;
}

function fmtSecs(s) {
  const abs = Math.abs(s);
  const str = abs % 1 === 0 ? String(abs) : parseFloat(abs.toFixed(3)).toString();
  return s < 0 ? '-' + str : str;
}

function fmtTimecode(s) {
  const neg = s < 0;
  const abs = Math.abs(s);
  const ms = Math.round((abs % 1) * 1000);
  const totalSecs = Math.floor(abs);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hours = Math.floor(totalSecs / 3600);
  const msSuffix = ms > 0 ? '.' + String(ms).padStart(3, '0').replace(/0+$/, '') : '';
  const secStr = String(secs).padStart(2, '0') + msSuffix;
  const result = hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${secStr}`
    : `${mins}:${secStr}`;
  return neg ? '-' + result : result;
}

export function TimeRange(field) {
  let lengthMode = field.length === true;
  const showToggle = field.toggle !== false;
  const minVal = field.min ?? 0;
  const fmt = field.seconds ? fmtSecs : fmtTimecode;

  const container = document.createElement('div');
  container.className = 'time-range';

  const inputsRow = document.createElement('div');
  inputsRow.className = 'time-range-inputs';

  function makeField(placeholder) {
    const wrap = document.createElement('div');
    wrap.className = 'input';
    const ctrl = document.createElement('div');
    ctrl.className = 'control has-unit';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = placeholder;
    inp.spellcheck = false;
    inp.addEventListener('change', (e) => e.stopPropagation());
    // the unit box doubles as the field label (from/to/skip/length)
    const unit = document.createElement('div');
    unit.className = 'unit-box';
    unit.tabIndex = -1;
    unit.style.cursor = 'default';
    ctrl.appendChild(inp);
    ctrl.appendChild(unit);
    wrap.appendChild(ctrl);
    return { wrap, inp, unit };
  }

  const negPlaceholder = field.seconds ? '[-]seconds' : '[-][[HH:]MM:]SS';
  const posPlaceholder = field.seconds ? 'seconds' : '[[HH:]MM:]SS';
  const { wrap: fromWrap, inp: fromInp, unit: fromUnit } = makeField(negPlaceholder);
  const { wrap: toWrap, inp: toInp, unit: toUnit } = makeField(negPlaceholder);
  inputsRow.appendChild(fromWrap);
  inputsRow.appendChild(toWrap);

  // runtime mode-toggle button shown after the second input
  let toggleBtn = null;
  if (showToggle) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'tr-mode-toggle';
    toggleBtn.appendChild(iconSpan('change'));
    inputsRow.appendChild(toggleBtn);
  }

  const popup = document.createElement('div');
  popup.className = 'tr-popup';
  popup.hidden = true;

  const popupRow = document.createElement('div');
  popupRow.className = 'tr-popup-row';

  function makeSignBtn() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'time-sign';
    b.textContent = '+';
    return b;
  }

  const fromSignBtn = makeSignBtn();
  const toSignBtn = makeSignBtn();

  const trackWrapper = document.createElement('div');
  trackWrapper.className = 'tr-track-wrapper';

  function makeThumb() {
    const t = document.createElement('input');
    t.type = 'range';
    t.className = 'tr-thumb';
    t.min = minVal;
    t.step = 'any';
    t.value = minVal;
    t.max = minVal;
    return t;
  }

  const startThumb = makeThumb();
  const endThumb = makeThumb();

  trackWrapper.appendChild(startThumb);
  trackWrapper.appendChild(endThumb);
  popupRow.appendChild(fromSignBtn);
  popupRow.appendChild(trackWrapper);
  popupRow.appendChild(toSignBtn);
  popup.appendChild(popupRow);

  container.appendChild(inputsRow);
  container.appendChild(popup);

  let signFrom = '+';
  let signTo = '+';

  // undefined max → track length (file) or render length (mic), via field.getMax
  function getMax() {
    if (field.max != null) return field.max;
    if (field.getMax) return field.getMax() || 0;
    return 0;
  }

  // negative value = seconds before end → resolve to absolute track position
  function resolveNeg(v, max) {
    const pos = v < 0 ? max + v : v;
    return Math.min(Math.max(minVal, pos), max);
  }

  // reflect the current mode in labels, placeholders, and the toggle/sign buttons
  function applyModeUI() {
    fromUnit.textContent = lengthMode ? 'skip' : 'from';
    toUnit.textContent = lengthMode ? 'length' : 'to';
    toInp.placeholder = lengthMode ? posPlaceholder : negPlaceholder;
    toSignBtn.style.display = lengthMode ? 'none' : '';
  }

  // handle position → signed value, per the field's current sign
  function signedFromHandle(pos, sign, max) {
    return sign === '-' ? pos - max : pos;
  }

  function parseFrom() {
    return parseTimecodeStr(fromInp.value);
  }

  function parseTo() {
    const v = parseTimecodeStr(toInp.value);
    if (v == null) return null;
    return lengthMode && v < 0 ? null : v; // length is positive only
  }

  function updateGradient() {
    const max = parseFloat(startThumb.max) || 0;
    const range = max - minVal;
    if (range <= 0) return;
    const startPct = ((parseFloat(startThumb.value) - minVal) / range) * 100;
    const endPct = ((parseFloat(endThumb.value) - minVal) / range) * 100;
    trackWrapper.style.setProperty(
      '--track-bg',
      `linear-gradient(to right, var(--color-field) ${startPct}%, var(--color-fg) ${startPct}%, var(--color-fg) ${endPct}%, var(--color-field) ${endPct}%)`
    );
  }

  // second field text from the two handle positions
  function renderField2(startPos, endPos, max) {
    if (lengthMode) {
      const len = endPos - startPos;
      toInp.value = len > 0 ? fmt(len) : '';
    } else {
      toInp.value = fmt(signedFromHandle(endPos, signTo, max));
    }
  }

  function getValue() {
    const from = parseFrom();
    let to;
    if (lengthMode) {
      const len = parseTo();
      to = from != null && len != null ? from + len : null;
    } else {
      to = parseTo();
    }
    return { from: from ?? null, to: to ?? null };
  }

  function emitChange() {
    emit(container, getValue());
  }

  // position both handles from the current text values
  function syncHandles() {
    const max = getMax();
    startThumb.max = max;
    endThumb.max = max;
    const from = parseFrom() ?? minVal;
    const startPos = resolveNeg(from, max);
    let endPos;
    if (lengthMode) {
      const len = parseTo();
      endPos = len != null ? startPos + len : (max > minVal ? max : startPos);
    } else {
      const to = parseTo();
      endPos = to != null ? resolveNeg(to, max) : (max > minVal ? max : startPos);
    }
    endPos = Math.min(Math.max(endPos, startPos), max);
    startThumb.value = startPos;
    endThumb.value = endPos;
    updateGradient();
  }

  startThumb.addEventListener('input', () => {
    const max = getMax();
    const startPos = parseFloat(startThumb.value);
    let endPos = parseFloat(endThumb.value);
    if (startPos > endPos) { endPos = startPos; endThumb.value = endPos; }
    fromInp.value = fmt(signedFromHandle(startPos, signFrom, max));
    renderField2(startPos, endPos, max);
    updateGradient();
    emitChange();
  });

  endThumb.addEventListener('input', () => {
    const max = getMax();
    const startPos = parseFloat(startThumb.value);
    let endPos = parseFloat(endThumb.value);
    if (endPos < startPos) { endPos = startPos; endThumb.value = endPos; }
    renderField2(startPos, endPos, max);
    updateGradient();
    emitChange();
  });

  fromInp.addEventListener('input', () => {
    const from = parseFrom();
    if (from == null) return;
    const max = getMax();
    signFrom = from < 0 ? '-' : '+';
    fromSignBtn.textContent = signFrom;
    const startPos = resolveNeg(from, max);
    let endPos = parseFloat(endThumb.value);
    if (startPos > endPos) endPos = startPos;
    startThumb.value = startPos;
    endThumb.value = endPos;
    renderField2(startPos, endPos, max);
    updateGradient();
    emitChange();
  });

  toInp.addEventListener('input', () => {
    const to = parseTo();
    if (to == null) return;
    const max = getMax();
    const startPos = parseFloat(startThumb.value);
    let endPos;
    if (lengthMode) {
      endPos = Math.min(startPos + to, max);
    } else {
      signTo = to < 0 ? '-' : '+';
      toSignBtn.textContent = signTo;
      endPos = Math.max(resolveNeg(to, max), startPos);
    }
    endThumb.value = endPos;
    updateGradient();
    emitChange();
  });

  fromInp.addEventListener('blur', () => {
    const v = parseFrom();
    if (v != null) fromInp.value = fmt(v);
  });

  toInp.addEventListener('blur', () => {
    const v = parseTo();
    if (v != null) toInp.value = fmt(v);
  });

  fromSignBtn.addEventListener('click', () => {
    const max = getMax();
    signFrom = signFrom === '+' ? '-' : '+';
    fromSignBtn.textContent = signFrom;
    fromInp.value = fmt(signedFromHandle(parseFloat(startThumb.value), signFrom, max));
    emitChange();
  });

  toSignBtn.addEventListener('click', () => {
    const max = getMax();
    signTo = signTo === '+' ? '-' : '+';
    toSignBtn.textContent = signTo;
    toInp.value = fmt(signedFromHandle(parseFloat(endThumb.value), signTo, max));
    emitChange();
  });

  // switch From/To ↔ Skip/Length at runtime; value { from, to } is preserved
  function toggleMode() {
    const val = getValue();
    lengthMode = !lengthMode;
    applyModeUI();
    container.setValue(val);
  }

  if (toggleBtn) toggleBtn.addEventListener('click', toggleMode);

  function openPopup() {
    if (field.seek === false) return;
    if (getMax() <= minVal) return;
    syncHandles();
    popup.hidden = false;
    positionPopup(container, popup);
  }

  function closePopup() {
    popup.hidden = true;
  }

  fromInp.addEventListener('focus', () => { if (popup.hidden) openPopup(); });
  toInp.addEventListener('focus', () => { if (popup.hidden) openPopup(); });

  popup.addEventListener('mousedown', (e) => {
    if (e.target !== startThumb && e.target !== endThumb
      && e.target !== fromSignBtn && e.target !== toSignBtn) e.preventDefault();
  });

  container.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && !popup.hidden) { evt.stopPropagation(); closePopup(); }
  });

  container.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!popup.hidden && !container.contains(document.activeElement)) closePopup();
    });
  });

  container.getValue = getValue;

  container.setValue = ({ from, to } = {}) => {
    signFrom = from != null && from < 0 ? '-' : '+';
    fromSignBtn.textContent = signFrom;
    fromInp.value = from != null ? fmt(from) : '';
    if (lengthMode) {
      toInp.value = from != null && to != null ? fmt(to - from) : '';
    } else {
      signTo = to != null && to < 0 ? '-' : '+';
      toSignBtn.textContent = signTo;
      toInp.value = to != null ? fmt(to) : '';
    }
    syncHandles();
    emitChange();
  };

  applyModeUI();
  if (field.value != null) container.setValue(field.value);

  return container;
}

export function Time(field) {
  const fmt = field.seconds ? fmtSecs : fmtTimecode;

  const container = document.createElement('div');
  container.className = 'control has-unit';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = field.value ?? '';
  input.placeholder = field.seconds ? '[-]seconds' : '[-][[HH:]MM:]SS[.mmm]';
  input.spellcheck = false;
  input.addEventListener('change', (evt) => {
    evt.stopPropagation();
  });

  const unitBox = document.createElement('div');
  unitBox.className = 'unit-box';
  unitBox.textContent = 'time';
  unitBox.tabIndex = -1;
  unitBox.style.cursor = 'default';

  const popup = document.createElement('div');
  popup.className = 'time-popup';
  popup.hidden = true;

  const popupRow = document.createElement('div');
  popupRow.className = 'time-popup-row';

  const signBtn = document.createElement('button');
  signBtn.className = 'time-sign';
  signBtn.type = 'button';
  signBtn.textContent = '+';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'time-slider';
  slider.min = 0;
  slider.step = 'any';
  slider.value = 0;
  slider.max = 0;

  popupRow.appendChild(signBtn);
  popupRow.appendChild(slider);
  popup.appendChild(popupRow);

  let sign = '+';
  let suppressSync = false;

  // Thumb represents track position in both modes:
  //   + → output = trackPos (seconds from start)
  //   - → output = trackPos - duration (seconds before end, negative)
  function getOutputValue() {
    const trackPos = parseFloat(slider.value);
    const dur = parseFloat(slider.max) || 0;
    return sign === '-' ? trackPos - dur : trackPos;
  }

  function updateGradient() {
    const max = parseFloat(slider.max) || 0;
    const pct = max > 0 ? (parseFloat(slider.value) / max) * 100 : 0;
    const a = sign === '+' ? 0 : pct;
    const b = sign === '+' ? pct : 100;
    slider.style.setProperty('--track-bg', `linear-gradient(to right, var(--color-field) ${a}%, var(--color-fg) ${a}%, var(--color-fg) ${b}%, var(--color-field) ${b}%)`);
  }

  function syncSliderFromInput() {
    const parsed = parseTimecodeStr(input.value);
    if (parsed == null) return;
    sign = parsed < 0 ? '-' : '+';
    signBtn.textContent = sign;
    const dur = parseFloat(slider.max) || 0;
    // convert raw value to track position
    const trackPos = parsed < 0 ? dur + parsed : parsed;
    slider.value = Math.max(0, Math.min(trackPos, dur));
    updateGradient();
  }

  function applyPopupChange(formatted) {
    input.value = formatted;
    updateGradient();
    const parsed = parseTimecodeStr(formatted);
    if (parsed != null) emit(container, parsed);
    suppressSync = true;
    input.dispatchEvent(new Event('input'));
    suppressSync = false;
  }

  signBtn.addEventListener('click', () => {
    sign = sign === '+' ? '-' : '+';
    signBtn.textContent = sign;
    applyPopupChange(fmt(getOutputValue()));
  });

  slider.addEventListener('input', () => {
    applyPopupChange(fmt(getOutputValue()));
  });

  input.addEventListener('input', () => {
    if (!suppressSync && !popup.hidden) syncSliderFromInput();
    if (!suppressSync) {
      const parsed = parseTimecodeStr(input.value);
      if (parsed != null) emit(container, parsed);
    }
  });

  input.addEventListener('blur', () => {
    const parsed = parseTimecodeStr(input.value);
    if (parsed != null) input.value = fmt(parsed);
  });

  function closePopup() {
    popup.hidden = true;
  }

  function openPopup() {
    if (field.seek === false) return;
    slider.max = field.getDuration ? (field.getDuration() || 0) : (field.max ?? 3600);
    if (field.getDuration && slider.max == 0) return;
    syncSliderFromInput();
    popup.hidden = false;
    positionPopup(container, popup);
  }

  popup.addEventListener('mousedown', (e) => {
    if (e.target !== slider && e.target !== signBtn) e.preventDefault();
  });

  input.addEventListener('focus', () => { if (popup.hidden) openPopup(); });

  container.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && !popup.hidden) { evt.stopPropagation(); closePopup(); }
  });

  container.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!popup.hidden && !container.contains(document.activeElement)) closePopup();
    });
  });

  container.appendChild(input);
  container.appendChild(unitBox);
  container.appendChild(popup);

  container.getValue = () => parseTimecodeStr(input.value) ?? null;
  container.setValue = (v) => {
    input.value = typeof v === 'number' ? fmt(v) : (v ?? '');
    syncSliderFromInput();
    emit(container, container.getValue());
  };

  return container;
}
