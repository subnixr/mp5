export const DEFAULT_THEME = 'dark';
export const DEFAULT_BG = '#000000';

// theme controls window chrome colors (CSS tokens) via a root attribute;
// dark is the default (no attribute), light swaps the token block in base.css
export function applyTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}

// visualizer-only: recolors the application background (letterbox around the
// canvas), independent of theme and of the rendered output background
export function applyVisualizerBg(color) {
  document.body.style.background = color;
}
