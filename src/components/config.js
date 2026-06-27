import fs from 'fs';
import path from 'path';
import { DEFAULT_THEME, DEFAULT_BG } from './theme.js';

// persistent app-level config (theme/bg + render defaults). lives in a
// per-platform file (see resolveConfigPath in src/index.js), overridable with
// -c. config is the lowest-priority default source for rendering: CLI > preset >
// canvas hint > config > hardcoded defaults.
export const DEFAULT_CONFIG = {
  gui: { theme: DEFAULT_THEME, bgColor: DEFAULT_BG },
  rendering: {},
};

function cloneDefaults() {
  return {
    gui: { ...DEFAULT_CONFIG.gui },
    rendering: { ...DEFAULT_CONFIG.rendering },
  };
}

// read+parse, merging over defaults; never throws (missing file or bad JSON
// both yield defaults so the app always launches)
export function readConfig(filePath) {
  const cfg = cloneDefaults();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw.gui) Object.assign(cfg.gui, raw.gui);
    if (raw.rendering) Object.assign(cfg.rendering, raw.rendering);
  } catch (_) {
    // missing file or parse error: keep defaults
  }
  return cfg;
}

export function writeConfig(filePath, cfg) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2));
}

// create the file with defaults on first run if absent, then read it. a parse
// error does NOT overwrite an existing (corrupt) file — only a truly missing
// file is created.
export function ensureConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    try {
      writeConfig(filePath, DEFAULT_CONFIG);
    } catch (_) {
      // best-effort; readConfig still returns defaults
    }
  }
  return readConfig(filePath);
}
