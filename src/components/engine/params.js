export function createParams() {
  const GROUP = Symbol('group');
  const TITLE = Symbol('title');
  const OBJ = Symbol('obj');
  const registry = new Map();
  const groups = [];
  let pending = {};

  function makeParamObj(key) {
    return {
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

  function fieldFor(key) {
    const entry = registry.get(key);
    if (!entry) return null;
    const { type = 'text', label = key, ...rest } = entry.opts;
    return { key, label, type, value: entry.value, ...rest };
  }

  function params(key, defaultValue, opts) {
    if (arguments.length === 1) {
      return makeParamObj(key);
    }

    const existing = registry.get(key);
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
      out[key] = Array.isArray(entry.value) ? [...entry.value] : entry.value;
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
    for (const key of registry.keys()) {
      if (!groupedKeys.has(key)) {
        const f = fieldFor(key);
        if (f) fields.push(f);
      }
    }
    return { groups: groupDefs, fields };
  };

  params.applyPreserved = function (preserved) {
    for (const [key, pval] of Object.entries(preserved)) {
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
