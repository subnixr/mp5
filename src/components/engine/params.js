export function createParams() {
  const GROUP = Symbol('group');
  const TITLE = Symbol('title');
  const OBJ = Symbol('obj');
  const registry = new Map();
  const groups = [];
  const combos = new Map();
  const comboSubKeys = new Set();
  const defOrder = [];
  let pending = {};

  function makeParamObj(key) {
    return {
      _key: key,
      get value() {
        const entry = registry.get(key);
        const v = entry.value;
        return Array.isArray(v) ? [...v] : v;
      },
      onChange(cb) {
        const entry = registry.get(key);
        entry.subscribers.add(cb);
        const v = entry.value;
        cb(Array.isArray(v) ? [...v] : v);
        return () => entry.subscribers.delete(cb);
      },
    };
  }

  function makeRepeaterProxy(key) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'value') {
          return [...(registry.get(key)?.value ?? [])];
        }
        if (prop === 'length') {
          return registry.get(key)?.value?.length ?? 0;
        }
        const i = typeof prop === 'string' ? parseInt(prop) : NaN;
        if (!isNaN(i)) {
          return {
            get value() {
              return registry.get(key)?.value?.[i];
            },
            onChange(cb) {
              const entry = registry.get(key);
              const wrapper = (arr) => cb(arr[i]);
              entry.subscribers.add(wrapper);
              wrapper(entry.value);
              return () => entry.subscribers.delete(wrapper);
            },
          };
        }
        return undefined;
      },
    });
  }

  function applyFlexDefaults(items) {
    if (items.every(i => i.flex == null)) {
      items.forEach((item, i) => {
        item.flex = i === items.length - 1 ? 1 : 'auto';
      });
    }
  }

  function buildComboDef(key) {
    const { label, subKeys } = combos.get(key);
    const items = subKeys.map(sk => {
      const entry = registry.get(sk);
      if (!entry) return null;
      const { type = 'text', flex, label: _ignored, ...rest } = entry.opts;
      return { key: sk, type, value: entry.value, flex, ...rest };
    }).filter(Boolean);
    applyFlexDefaults(items);
    return { key, label, type: 'combo', items };
  }

  function fieldFor(key) {
    const entry = registry.get(key);

    if (!entry) {
      if (combos.has(key)) return buildComboDef(key);
      return null;
    }

    if (entry.opts._isRepeater && entry.opts._isCombo) {
      const { _rMin: min, _rMax: max, label = key, subKeys } = entry.opts;
      const items = subKeys.map(sk => {
        const subEntry = registry.get(sk);
        if (!subEntry) return null;
        const { type = 'text', flex, label: _ignored, ...rest } = subEntry.opts;
        return { key: sk, type, value: subEntry.defaultValue, flex, ...rest };
      }).filter(Boolean);
      applyFlexDefaults(items);
      const elementDefault = {};
      for (const item of items) elementDefault[item.key] = item.value;
      return {
        key,
        label,
        type: 'repeater',
        min,
        max,
        itemDef: { type: 'combo', label: false, items, value: elementDefault },
        value: [...entry.value],
      };
    }

    if (entry.opts._isRepeater) {
      const { _isRepeater, _rMin: min, _rMax: max, ...itemOpts } = entry.opts;
      const { type = 'text', label = key, ...rest } = itemOpts;
      return { key, label, type: 'repeater', min, max, itemDef: { type, label, value: entry.elementDefault, ...rest }, value: [...entry.value] };
    }

    const { type = 'text', label = key, ...rest } = entry.opts;
    return { key, label, type, value: entry.value, ...rest };
  }

  function params(key, defaultValue, opts) {
    if (arguments.length === 1) {
      return makeParamObj(key);
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
    registry.set(key, {
      value,
      defaultValue,
      opts: opts ?? {},
      subscribers: existing?.subscribers ?? new Set(),
    });
    return makeParamObj(key);
  }

  params.repeater = function (paramObj, defaults, opts = {}) {
    const key = paramObj._key;
    const { min = 0, max = null } = opts;

    if (paramObj._isCombo) {
      const comboInfo = combos.get(key);
      if (!comboInfo) throw new Error(`params.repeater: combo "${key}" not registered`);

      const { subKeys } = comboInfo;
      const elementDefault = {};
      for (const sk of subKeys) {
        elementDefault[sk] = registry.get(sk)?.defaultValue ?? null;
      }

      const initialValue = defaults ? [...defaults] : [];
      while (initialValue.length < min) initialValue.push({ ...elementDefault });

      const existing = registry.get(key);
      registry.set(key, {
        value: initialValue,
        defaultValue: [...initialValue],
        elementDefault,
        opts: { _isCombo: true, _isRepeater: true, _rMin: min, _rMax: max, label: comboInfo.label, subKeys },
        subscribers: existing?.subscribers ?? new Set(),
      });

      return makeRepeaterProxy(key);
    }

    const entry = registry.get(key);
    if (!entry) throw new Error(`params.repeater: key "${key}" not registered`);
    if (entry.opts._isRepeater) throw new Error(`params.repeater: "${key}" is already a repeater`);

    const elementDefault = entry.defaultValue;
    const initialValue = defaults ? [...defaults] : [];
    while (initialValue.length < min) initialValue.push(elementDefault);
    registry.set(key, {
      ...entry,
      value: initialValue,
      defaultValue: initialValue,
      elementDefault,
      opts: { ...entry.opts, _isRepeater: true, _rMin: min, _rMax: max },
    });
    return makeRepeaterProxy(key);
  };

  params.combo = function (key, label, ...paramObjs) {
    if (!combos.has(key)) defOrder.push({ kind: 'combo', key });
    combos.set(key, { label, subKeys: paramObjs.map(p => p._key) });
    for (const p of paramObjs) comboSubKeys.add(p._key);

    const result = { _key: key, _isCombo: true };
    for (const p of paramObjs) result[p._key] = p;
    return result;
  };

  let _canvas = null;
  params.canvas = function (w, h) { _canvas = { w, h }; };
  params.canvas.get = () => _canvas;

  params.group = function (title, obj) {
    const result = { ...obj };
    result[GROUP] = true;
    result[TITLE] = title;
    result[OBJ] = obj;
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
      if (entry.opts._isCombo && !entry.opts._isRepeater) {
        const composite = {};
        for (const sk of entry.opts.subKeys ?? []) {
          const subEntry = registry.get(sk);
          if (subEntry) composite[sk] = subEntry.value;
        }
        out[key] = composite;
      } else {
        out[key] = Array.isArray(entry.value) ? [...entry.value] : entry.value;
      }
    }
    for (const [key, { subKeys }] of combos) {
      if (registry.has(key)) continue;
      const composite = {};
      for (const sk of subKeys) {
        const subEntry = registry.get(sk);
        if (subEntry) composite[sk] = subEntry.value;
      }
      out[key] = composite;
    }
    return out;
  };

  params.getDefinitions = function () {
    const nestedGroups = new Set();
    for (const g of groups) {
      for (const val of Object.values(g[OBJ])) {
        if (val?.[GROUP]) nestedGroups.add(val);
      }
    }
    const topLevel = groups.filter((g) => !nestedGroups.has(g));

    function buildGroupDef(g) {
      const subgroupedKeys = new Set();
      for (const val of Object.values(g[OBJ])) {
        if (val?.[GROUP]) {
          for (const k of collectKeys(val)) subgroupedKeys.add(k);
        }
      }
      const items = [];
      for (const [k, val] of Object.entries(g[OBJ])) {
        if (val?.[GROUP]) {
          items.push(buildGroupDef(val));
        } else if (!subgroupedKeys.has(k)) {
          const f = fieldFor(k);
          if (f) items.push(f);
        }
      }
      return { title: g[TITLE], items };
    }

    function collectKeys(g) {
      const keys = new Set();
      for (const [k, val] of Object.entries(g[OBJ])) {
        if (val?.[GROUP]) {
          for (const nk of collectKeys(val)) keys.add(nk);
        } else {
          keys.add(k);
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
      if (kind === 'param') {
        if (comboSubKeys.has(key)) continue;
        const f = fieldFor(key);
        if (f) fields.push(f);
      } else if (kind === 'combo') {
        const f = fieldFor(key);
        if (f) fields.push(f);
      }
    }

    return { groups: groupDefs, fields };
  };

  params.applyPreserved = function (preserved) {
    for (const [key, pval] of Object.entries(preserved)) {
      if (combos.has(key) && !registry.has(key)) {
        if (typeof pval !== 'object' || pval === null || Array.isArray(pval)) continue;
        const { subKeys } = combos.get(key);
        for (const sk of subKeys) {
          const subEntry = registry.get(sk);
          if (!subEntry || !(sk in pval)) continue;
          const subVal = pval[sk];
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
