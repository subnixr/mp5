function resolveDisabled(d, registry) {
  if (!d) return null;
  let disabledKey, disabledIs;
  if (typeof d === 'string') {
    disabledKey = d;
  } else if (d._key) {
    disabledKey = d._key;
  } else if (d.param) {
    disabledKey = d.param._key ?? d.param;
    disabledIs = d.is;
  }
  if (!disabledKey) return null;
  const raw = registry.get(disabledKey)?.value ?? false;
  const disabledValue =
    disabledIs !== undefined ? raw === disabledIs : Boolean(raw);
  return {
    disabledKey,
    ...(disabledIs !== undefined ? { disabledIs } : {}),
    disabledValue,
  };
}

export function createParams() {
  const GROUP = Symbol('group');
  const LABEL = Symbol('label');
  const CHILDREN = Symbol('children');
  const registry = new Map();
  const groups = [];
  const combos = new Map();
  const comboSubKeys = new Set();
  const grids = new Map();
  const gridSubKeys = new Set();
  const repeaterFields = new Set();
  const defOrder = [];
  let pending = {};

  function makeParamObj(keyRef) {
    return {
      get _key() {
        return keyRef.k;
      },
      get value() {
        const entry = registry.get(keyRef.k);
        const v = entry.value;
        return Array.isArray(v) ? [...v] : v;
      },
      onChange(cb) {
        const entry = registry.get(keyRef.k);
        entry.subscribers.add(cb);
        const v = entry.value;
        cb(Array.isArray(v) ? [...v] : v);
        return () => entry.subscribers.delete(cb);
      },
    };
  }

  function makeRepeaterProxy(keyRef) {
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === '_key') return keyRef.k;
          if (prop === 'value') {
            return [...(registry.get(keyRef.k)?.value ?? [])];
          }
          if (prop === 'length') {
            return registry.get(keyRef.k)?.value?.length ?? 0;
          }
          const i = typeof prop === 'string' ? parseInt(prop) : NaN;
          if (!isNaN(i)) {
            return {
              get value() {
                return registry.get(keyRef.k)?.value?.[i];
              },
              onChange(cb) {
                const entry = registry.get(keyRef.k);
                const wrapper = (arr) => cb(arr[i]);
                entry.subscribers.add(wrapper);
                wrapper(entry.value);
                return () => entry.subscribers.delete(wrapper);
              },
            };
          }
          return undefined;
        },
      },
    );
  }

  function applyFlexDefaults(items) {
    if (items.every((i) => i.flex == null)) {
      items.forEach((item, i) => {
        item.flex = i === items.length - 1 ? 1 : 'auto';
      });
    }
  }

  function rekey(oldKey, newKey) {
    if (oldKey === newKey) return;
    const entry = registry.get(oldKey);
    if (!entry) return;
    entry.keyRef.k = newKey;
    registry.delete(oldKey);
    registry.set(newKey, entry);
    const di = defOrder.find((d) => d.key === oldKey);
    if (di) di.key = newKey;
    if (comboSubKeys.has(oldKey)) {
      comboSubKeys.delete(oldKey);
      comboSubKeys.add(newKey);
    }
    if (gridSubKeys.has(oldKey)) {
      gridSubKeys.delete(oldKey);
      gridSubKeys.add(newKey);
    }
    if (repeaterFields.has(oldKey)) {
      repeaterFields.delete(oldKey);
      repeaterFields.add(newKey);
    }
  }

  function rekeyChild(child, prefix) {
    if (!child?._key) return;
    const oldKey = child._key;
    const newKey = prefix + '.' + oldKey;

    if (child._isCombo) {
      const info = combos.get(oldKey);
      if (info) {
        const newSubKeys = info.subKeys.map((sk) => {
          const nsk = prefix + '.' + sk;
          rekey(sk, nsk);
          return nsk;
        });
        combos.delete(oldKey);
        combos.set(newKey, { ...info, subKeys: newSubKeys });
        const di = defOrder.find((d) => d.key === oldKey && d.kind === 'combo');
        if (di) di.key = newKey;
      }
      child._key = newKey;
    } else if (child._isGrid) {
      const info = grids.get(oldKey);
      if (info) {
        const newSubKeys = info.subKeys.map((sk) => {
          const nsk = prefix + '.' + sk;
          rekey(sk, nsk);
          return nsk;
        });
        grids.delete(oldKey);
        grids.set(newKey, { ...info, subKeys: newSubKeys });
        const di = defOrder.find((d) => d.key === oldKey && d.kind === 'grid');
        if (di) di.key = newKey;
      }
      child._key = newKey;
    } else if (child?.[GROUP]) {
      for (const grandchild of child[CHILDREN]) {
        if (grandchild?._key) rekeyChild(grandchild, prefix);
      }
      child._key = newKey;
    } else {
      rekey(oldKey, newKey);
    }
  }

  function buildComboDef(key) {
    const { label, subKeys, disabled } = combos.get(key);
    const prefix = key + '.';
    const items = subKeys
      .map((sk) => {
        const entry = registry.get(sk);
        if (!entry) return null;
        const { type = 'text', flex, label: _ignored, ...rest } = entry.opts;
        const leafKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
        return {
          key: leafKey,
          paramKey: sk,
          type,
          value: entry.value,
          flex,
          ...rest,
        };
      })
      .filter(Boolean);
    applyFlexDefaults(items);
    const disabledDef = resolveDisabled(disabled, registry);
    return { key, label, type: 'combo', items, ...(disabledDef ?? {}) };
  }

  function buildGridDef(key) {
    const { columns, subKeys, disabled } = grids.get(key);
    const prefix = key + '.';
    const items = subKeys
      .map((sk) => {
        const entry = registry.get(sk);
        if (!entry) return null;
        const { type = 'text', ...rest } = entry.opts;
        const leafKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
        return {
          key: leafKey,
          paramKey: sk,
          type,
          value: entry.value,
          ...rest,
        };
      })
      .filter(Boolean);
    const disabledDef = resolveDisabled(disabled, registry);
    return { key, type: 'grid', columns, items, ...(disabledDef ?? {}) };
  }

  function fieldFor(key) {
    const entry = registry.get(key);

    if (!entry) {
      if (combos.has(key)) return buildComboDef(key);
      if (grids.has(key)) return buildGridDef(key);
      return null;
    }

    if (entry.opts._isRepeater && entry.opts._isGrid) {
      const {
        _rMin: min,
        _rMax: max,
        columns,
        subKeys,
        gridKey,
        disabled,
      } = entry.opts;
      const wrapKey = gridKey ?? key;
      const items = subKeys
        .map((sk) => {
          const subEntry = registry.get(sk);
          if (!subEntry) return null;
          const { type = 'text', ...rest } = subEntry.opts;
          const leafKey = sk.slice(wrapKey.length + 1);
          return { key: leafKey, type, value: subEntry.defaultValue, ...rest };
        })
        .filter(Boolean);
      const elementDefault = {};
      for (const item of items) elementDefault[item.key] = item.value;
      const disabledDef = resolveDisabled(disabled, registry);
      return {
        key,
        label: entry.opts.label ?? key,
        type: 'repeater',
        min,
        max,
        itemDef: {
          type: 'grid',
          label: false,
          columns,
          items,
          value: elementDefault,
        },
        value: [...entry.value],
        ...(disabledDef ?? {}),
      };
    }

    if (entry.opts._isRepeater && entry.opts._isCombo) {
      const {
        _rMin: min,
        _rMax: max,
        label = key,
        subKeys,
        comboKey,
        disabled,
      } = entry.opts;
      const wrapKey = comboKey ?? key;
      const items = subKeys
        .map((sk) => {
          const subEntry = registry.get(sk);
          if (!subEntry) return null;
          const {
            type = 'text',
            flex,
            label: _ignored,
            ...rest
          } = subEntry.opts;
          const leafKey = sk.slice(wrapKey.length + 1);
          return {
            key: leafKey,
            type,
            value: subEntry.defaultValue,
            flex,
            ...rest,
          };
        })
        .filter(Boolean);
      applyFlexDefaults(items);
      const elementDefault = {};
      for (const item of items) elementDefault[item.key] = item.value;
      const disabledDef = resolveDisabled(disabled, registry);
      return {
        key,
        label,
        type: 'repeater',
        min,
        max,
        itemDef: { type: 'combo', label: false, items, value: elementDefault },
        value: [...entry.value],
        ...(disabledDef ?? {}),
      };
    }

    if (entry.opts._isRepeater) {
      const {
        _isRepeater,
        _rMin: min,
        _rMax: max,
        disabled,
        ...itemOpts
      } = entry.opts;
      const { type = 'text', label = key, ...rest } = itemOpts;
      const disabledDef = resolveDisabled(disabled, registry);
      return {
        key,
        label,
        type: 'repeater',
        min,
        max,
        itemDef: { type, label, value: entry.elementDefault, ...rest },
        value: [...entry.value],
        ...(disabledDef ?? {}),
      };
    }

    const { type = 'text', label = key, disabled, ...rest } = entry.opts;
    const disabledDef = resolveDisabled(disabled, registry);
    return {
      key,
      label,
      type,
      value: entry.value,
      ...rest,
      ...(disabledDef ?? {}),
    };
  }

  function params(key, defaultValue, opts) {
    if (arguments.length === 1) {
      const entry = registry.get(key);
      if (entry?.keyRef) return makeParamObj(entry.keyRef);
      return makeParamObj({ k: key });
    }

    const existing = registry.get(key);
    if (!existing) defOrder.push({ kind: 'param', key });

    let value = defaultValue;
    if (existing) {
      const typeMatch = Array.isArray(defaultValue)
        ? Array.isArray(existing.value)
        : typeof existing.value === typeof defaultValue;
      if (typeMatch) value = existing.value;
    }
    const keyRef = existing?.keyRef ?? { k: key };
    keyRef.k = key;
    registry.set(key, {
      value,
      defaultValue,
      opts: opts ?? {},
      subscribers: existing?.subscribers ?? new Set(),
      keyRef,
    });
    return makeParamObj(keyRef);
  }

  params.repeater = function (key, defaults, field, opts = {}) {
    if (field._key !== key) rekeyChild(field, key);

    const fieldKey = field._key;
    const { min = 0, max = null, label } = opts;

    if (fieldKey !== key) repeaterFields.add(fieldKey);

    if (!defOrder.some((d) => d.key === key))
      defOrder.push({ kind: 'param', key });

    if (field._isGrid) {
      const gridInfo = grids.get(fieldKey);
      if (!gridInfo)
        throw new Error(`params.repeater: grid "${fieldKey}" not registered`);

      const { columns, subKeys } = gridInfo;
      const elementDefault = {};
      for (const sk of subKeys) {
        const leafKey = sk.slice(fieldKey.length + 1);
        elementDefault[leafKey] = registry.get(sk)?.defaultValue ?? null;
      }

      const initialValue = defaults ? [...defaults] : [];
      while (initialValue.length < min)
        initialValue.push({ ...elementDefault });

      const existing = registry.get(key);
      const keyRef = existing?.keyRef ?? { k: key };
      keyRef.k = key;
      registry.set(key, {
        value: initialValue,
        defaultValue: [...initialValue],
        elementDefault,
        opts: {
          _isGrid: true,
          _isRepeater: true,
          _rMin: min,
          _rMax: max,
          columns,
          subKeys,
          gridKey: fieldKey,
          ...(label !== undefined ? { label } : {}),
          ...(opts.disabled !== undefined ? { disabled: opts.disabled } : {}),
        },
        subscribers: existing?.subscribers ?? new Set(),
        keyRef,
      });

      return makeRepeaterProxy(keyRef);
    }

    if (field._isCombo) {
      const comboInfo = combos.get(fieldKey);
      if (!comboInfo)
        throw new Error(`params.repeater: combo "${fieldKey}" not registered`);

      const { subKeys } = comboInfo;
      const elementDefault = {};
      for (const sk of subKeys) {
        const leafKey = sk.slice(fieldKey.length + 1);
        elementDefault[leafKey] = registry.get(sk)?.defaultValue ?? null;
      }

      const initialValue = defaults ? [...defaults] : [];
      while (initialValue.length < min)
        initialValue.push({ ...elementDefault });

      const existing = registry.get(key);
      const keyRef = existing?.keyRef ?? { k: key };
      keyRef.k = key;
      registry.set(key, {
        value: initialValue,
        defaultValue: [...initialValue],
        elementDefault,
        opts: {
          _isCombo: true,
          _isRepeater: true,
          _rMin: min,
          _rMax: max,
          label: comboInfo.label,
          subKeys,
          comboKey: fieldKey,
          ...(opts.disabled !== undefined ? { disabled: opts.disabled } : {}),
        },
        subscribers: existing?.subscribers ?? new Set(),
        keyRef,
      });

      return makeRepeaterProxy(keyRef);
    }

    const entry = registry.get(fieldKey);
    if (!entry)
      throw new Error(`params.repeater: key "${fieldKey}" not registered`);

    const elementDefault = entry.defaultValue;
    const initialValue = defaults ? [...defaults] : [];
    while (initialValue.length < min) initialValue.push(elementDefault);

    const existing = registry.get(key);
    const keyRef = existing?.keyRef ?? { k: key };
    keyRef.k = key;
    registry.set(key, {
      value: initialValue,
      defaultValue: initialValue,
      elementDefault,
      opts: { ...entry.opts, _isRepeater: true, _rMin: min, _rMax: max },
      subscribers: existing?.subscribers ?? entry.subscribers,
      keyRef,
    });
    return makeRepeaterProxy(keyRef);
  };

  params.combo = function (key, label, ...paramObjs) {
    let opts = {};
    if (paramObjs.length > 0) {
      const last = paramObjs[paramObjs.length - 1];
      if (last !== null && typeof last === 'object' && !last._key && !last._isCombo && !last._isGrid) {
        opts = last;
        paramObjs = paramObjs.slice(0, -1);
      }
    }
    for (const p of paramObjs) rekeyChild(p, key);
    if (!combos.has(key)) defOrder.push({ kind: 'combo', key });
    combos.set(key, { label, subKeys: paramObjs.map((p) => p._key), disabled: opts.disabled });
    for (const p of paramObjs) comboSubKeys.add(p._key);

    const result = { _key: key, _isCombo: true };
    for (const p of paramObjs) {
      const leafKey = p._key.split('.').pop();
      result[leafKey] = p;
    }
    return result;
  };

  params.grid = function (key, columns, ...paramObjs) {
    let opts = {};
    if (paramObjs.length > 0) {
      const last = paramObjs[paramObjs.length - 1];
      if (last !== null && typeof last === 'object' && !last._key && !last._isCombo && !last._isGrid) {
        opts = last;
        paramObjs = paramObjs.slice(0, -1);
      }
    }
    for (const p of paramObjs) rekeyChild(p, key);
    if (!grids.has(key)) defOrder.push({ kind: 'grid', key });
    grids.set(key, { columns, subKeys: paramObjs.map((p) => p._key), disabled: opts.disabled });
    for (const p of paramObjs) gridSubKeys.add(p._key);

    const result = { _key: key, _isGrid: true };
    for (const p of paramObjs) {
      const leafKey = p._key.split('.').pop();
      result[leafKey] = p;
    }
    return result;
  };

  let _canvas = null;
  params.canvas = function (w, h) {
    _canvas = { w, h };
  };
  params.canvas.get = () => _canvas;

  params.group = function (key, label, ...children) {
    let groupOpts = {};
    if (children.length > 0) {
      const first = children[0];
      if (
        first !== null &&
        typeof first === 'object' &&
        !first._key &&
        !first._isCombo &&
        !first._isGrid &&
        !first[GROUP]
      ) {
        groupOpts = first;
        children = children.slice(1);
      }
    }
    for (const child of children) {
      if (child?._key) rekeyChild(child, key);
    }
    const result = { _key: key };
    for (const child of children) {
      if (child?._key) {
        const leafKey = child._key.split('.').pop();
        result[leafKey] = child;
      }
    }
    result[GROUP] = true;
    result[LABEL] = label;
    result[CHILDREN] = children;
    if (groupOpts.disabled != null) result._disabled = groupOpts.disabled;
    groups.push(result);
    return result;
  };

  params.flush = function () {
    for (const [key, newValue] of Object.entries(pending)) {
      const entry = registry.get(key);
      if (!entry) continue;

      if (entry.opts._isCombo && !entry.opts._isRepeater) {
        for (const subKey of entry.opts.subKeys ?? []) {
          const subEntry = registry.get(subKey);
          if (!subEntry || !(subKey in newValue)) continue;
          const subVal = newValue[subKey];
          subEntry.value = subVal;
          for (const cb of subEntry.subscribers) cb(subVal);
        }
        for (const cb of entry.subscribers) cb({ ...newValue });
        continue;
      }

      entry.value = newValue;
      const v = Array.isArray(newValue) ? [...newValue] : newValue;
      for (const cb of entry.subscribers) cb(v);
    }
    pending = {};
  };

  params.queue = function (updates) {
    Object.assign(pending, updates);
  };

  params.getValues = function () {
    const out = {};
    for (const [key, entry] of registry) {
      if (comboSubKeys.has(key)) continue;
      if (gridSubKeys.has(key)) continue;
      if (entry.opts._isCombo && !entry.opts._isRepeater) {
        const prefix = key + '.';
        const composite = {};
        for (const sk of entry.opts.subKeys ?? []) {
          const subEntry = registry.get(sk);
          if (subEntry) {
            const relKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
            composite[relKey] = subEntry.value;
          }
        }
        out[key] = composite;
      } else {
        out[key] = Array.isArray(entry.value) ? [...entry.value] : entry.value;
      }
    }
    for (const [key, { subKeys }] of combos) {
      if (registry.has(key)) continue;
      const prefix = key + '.';
      const composite = {};
      for (const sk of subKeys) {
        const subEntry = registry.get(sk);
        if (subEntry) {
          const relKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
          composite[relKey] = subEntry.value;
        }
      }
      out[key] = composite;
    }
    for (const [key, { subKeys }] of grids) {
      if (registry.has(key)) continue;
      const prefix = key + '.';
      const composite = {};
      for (const sk of subKeys) {
        const subEntry = registry.get(sk);
        if (subEntry) {
          const relKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
          composite[relKey] = subEntry.value;
        }
      }
      out[key] = composite;
    }
    return out;
  };

  params.getDefinitions = function () {
    const nestedGroups = new Set();
    for (const g of groups) {
      for (const child of g[CHILDREN]) {
        if (child?.[GROUP]) nestedGroups.add(child);
      }
    }
    const topLevel = groups.filter((g) => !nestedGroups.has(g));

    function buildGroupDef(g) {
      const items = [];
      for (const child of g[CHILDREN]) {
        if (child?.[GROUP]) {
          items.push(buildGroupDef(child));
        } else if (child?._key) {
          const f = fieldFor(child._key);
          if (f) items.push(f);
        }
      }
      const disabledDef = resolveDisabled(g._disabled, registry);
      return { title: g[LABEL], items, ...(disabledDef ?? {}) };
    }

    function collectKeys(g) {
      const keys = new Set();
      for (const child of g[CHILDREN]) {
        if (child?.[GROUP]) {
          for (const k of collectKeys(child)) keys.add(k);
        } else if (child?._key) {
          keys.add(child._key);
        }
      }
      return keys;
    }

    const groupedKeys = new Set();
    for (const g of topLevel) {
      for (const k of collectKeys(g)) groupedKeys.add(k);
    }

    const groupDefs = topLevel.map(buildGroupDef);
    const fields = [];

    for (const { kind, key } of defOrder) {
      if (groupedKeys.has(key)) continue;
      if (repeaterFields.has(key)) continue;
      if (kind === 'param') {
        if (comboSubKeys.has(key)) continue;
        if (gridSubKeys.has(key)) continue;
        const f = fieldFor(key);
        if (f) fields.push(f);
      } else if (kind === 'combo') {
        const f = fieldFor(key);
        if (f) fields.push(f);
      } else if (kind === 'grid') {
        const f = fieldFor(key);
        if (f) fields.push(f);
      }
    }

    return { groups: groupDefs, fields };
  };

  params.applyPreserved = function (preserved) {
    for (const [key, pval] of Object.entries(preserved)) {
      if (grids.has(key) && !registry.has(key)) {
        if (typeof pval !== 'object' || pval === null || Array.isArray(pval))
          continue;
        const { subKeys } = grids.get(key);
        const prefix = key + '.';
        for (const sk of subKeys) {
          const subEntry = registry.get(sk);
          if (!subEntry) continue;
          const relKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
          if (!(relKey in pval)) continue;
          const subVal = pval[relKey];
          const typeMatch = typeof subVal === typeof subEntry.defaultValue;
          if (!typeMatch) continue;
          subEntry.value = subVal;
          for (const cb of subEntry.subscribers) cb(subVal);
        }
        continue;
      }

      if (combos.has(key) && !registry.has(key)) {
        if (typeof pval !== 'object' || pval === null || Array.isArray(pval))
          continue;
        const { subKeys } = combos.get(key);
        const prefix = key + '.';
        for (const sk of subKeys) {
          const subEntry = registry.get(sk);
          if (!subEntry) continue;
          const relKey = sk.startsWith(prefix) ? sk.slice(prefix.length) : sk;
          if (!(relKey in pval)) continue;
          const subVal = pval[relKey];
          const typeMatch = typeof subVal === typeof subEntry.defaultValue;
          if (!typeMatch) continue;
          subEntry.value = subVal;
          for (const cb of subEntry.subscribers) cb(subVal);
        }
        continue;
      }

      const entry = registry.get(key);
      if (!entry) continue;
      const typeMatch = Array.isArray(entry.defaultValue)
        ? Array.isArray(pval)
        : typeof pval === typeof entry.defaultValue;
      if (!typeMatch) continue;
      entry.value = pval;
      const v = Array.isArray(pval) ? [...pval] : pval;
      for (const cb of entry.subscribers) cb(v);
    }
  };

  params.destroy = function () {
    for (const entry of registry.values()) {
      entry.subscribers.clear();
    }
  };

  return params;
}
