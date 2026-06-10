const outputInput = document.querySelector('#output-input');
const browseBtn = document.querySelector('#browse-btn');
const fpsInput = document.querySelector('#fps-input');
const widthInput = document.querySelector('#width-input');
const heightInput = document.querySelector('#height-input');
const skipInput = document.querySelector('#skip-input');
const lengthInput = document.querySelector('#length-input');
const ffmpegExtra = document.querySelector('#ffmpeg-extra');
const cancelBtn = document.querySelector('#cancel-btn');
const renderBtn = document.querySelector('#render-btn');

const DEFAULT_EXTRA = `-c:v libx264\n-pix_fmt yuv420p`;

function parseTimestamp(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.length > 3 || parts.some(isNaN)) return null;
  const [a, b, c] = parts;
  if (parts.length === 1) return a >= 0 ? a : null;
  if (parts.length === 2) return b >= 0 && b < 60 ? a * 60 + b : null;
  return b >= 0 && b < 60 && c >= 0 && c < 60 ? a * 3600 + b * 60 + c : null;
}

function validateTimestamp(input) {
  const val = input.value.trim();
  const invalid = val !== '' && parseTimestamp(val) === null;
  input.setCustomValidity(invalid ? `expected [[HH:]MM:]SS` : '');
}

function defaultOutputName() {
  const w = widthInput.value;
  const h = heightInput.value;
  const fps = fpsInput.value || '60';
  const parts = [window.args.sketch, window.args.audio].filter(Boolean);
  const base = parts.length ? parts.join(' - ') + ' - ' : '';
  return `${base}${w}x${h}@${fps}.mp4`;
}

widthInput.value = window.args.defaultWidth;
heightInput.value = window.args.defaultHeight;
outputInput.value = defaultOutputName();
ffmpegExtra.value = DEFAULT_EXTRA;

if (!window.args.audio) lengthInput.required = true;

skipInput.addEventListener('input', () => validateTimestamp(skipInput));
lengthInput.addEventListener('input', () => validateTimestamp(lengthInput));

let outputIsDefault = true;

outputInput.addEventListener('input', () => {
  outputIsDefault = outputInput.value === defaultOutputName();
});

function onRenderParamChange() {
  if (outputIsDefault) outputInput.value = defaultOutputName();
}

widthInput.addEventListener('change', onRenderParamChange);
heightInput.addEventListener('change', onRenderParamChange);
fpsInput.addEventListener('change', onRenderParamChange);

browseBtn.addEventListener('click', async () => {
  const filePath = await window.api.browse(outputInput.value);
  if (filePath) {
    outputInput.value = filePath;
    outputIsDefault = false;
  }
});

cancelBtn.addEventListener('click', () => {
  window.api.cancel();
});

renderBtn.addEventListener('click', () => {
  const output = outputInput.value.trim();
  if (!output) return;
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);
  if (!width || !height) {
    widthInput.focus();
    return;
  }
  validateTimestamp(skipInput);
  validateTimestamp(lengthInput);
  if (!skipInput.reportValidity() || !lengthInput.reportValidity()) return;
  const frameRate = Math.max(1, parseInt(fpsInput.value) || 60);
  const ffmpegExtraVal = ffmpegExtra.value.trim() || null;
  const startTime = parseTimestamp(skipInput.value.trim()) ?? 0;
  const length = parseTimestamp(lengthInput.value.trim()) ?? null;
  window.api.confirm({
    output,
    frameRate,
    width,
    height,
    ffmpegExtra: ffmpegExtraVal,
    startTime,
    length,
  });
});
