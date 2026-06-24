// preset (de)serialization: bridge the dotted flat keys used internally
// (registry, IPC, sketches) and the nested JSON shape used in preset files.

// flat dotted keys -> nested objects. only keys are split; values stay opaque.
export function toNested(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ??= {};
    node[parts.at(-1)] = value;
  }
  return out;
}

// nested objects -> flat dotted keys. generic recursive descent to leaves.
// arrays are leaves (repeater values); plain objects are descended. also
// normalizes already-flat presets (leaf-flat or composite-flat) for free.
export function fromNested(nested) {
  const out = {};

  function walk(prefix, node) {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(key, v);
      else out[key] = v;
    }
  }

  walk('', nested);
  return out;
}
