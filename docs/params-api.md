# Params API

Params let a sketch declare runtime-tweakable values. When a sketch defines params, the settings window (opened via the controls bar or `F12`) renders the corresponding UI controls. Values are editable in real time, persist across sketch reloads, and can be pre-seeded from the CLI.

## Canvas size hint

```js
params.canvas(W, H);
```

Declares the preferred canvas size for the sketch. Call once at the top of the sketch function, before `p.setup`.

- The visualizer window resizes to `W×H` (at 50% scale) when the sketch loads.
- The render settings width/height fields default to `W` and `H`.
- Overridden by the `-g WxH` CLI flag or a preset that specifies `rendering.width`/`height` — in those cases the canvas hint has no effect on the settings window.
- Sketches without a size preference omit the call entirely.

```js
export default function (p, audio, params) {
  params.canvas(1920, 1080);

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
  };
  // ...
}
```

---

## Declaring a parameter

```js
params(key, defaultValue, opts);
```

Registers a parameter and returns a param object. If a value for `key` was preserved from a previous load (or passed via CLI), the preserved value is used instead of `defaultValue`, provided the types match.

```js
const speed = params('speed', 1.0, {
  type: 'number',
  label: 'Speed',
  min: 0,
  max: 5,
  step: 0.1,
});
```

### Param object

```js
speed.value; // current value (read-only; arrays are cloned)

speed.onChange(cb); // subscribe to changes
// cb is called immediately with the current value
// returns an unsubscribe function
```

## Reading without registering

Calling `params(key)` with only one argument returns the param object for an already-registered key without re-registering it. Useful when splitting sketch code across functions.

```js
const speed = params('speed'); // get existing param, no default set
```

## Widget types

The `type` field in `opts` controls which UI control is rendered in the settings window. Default is `'text'` when `type` is omitted.

### `'number'`

Numeric input field.

```js
params('brightness', 0.8, {
  type: 'number',
  min: 0,
  max: 1,
  step: 0.01,
  decimals: 2, // fixed decimal display; also sets step if step is not provided
});

params('freq', 440, {
  type: 'number',
  label: 'Frequency',
  min: 20,
  max: 20000,
  unit: 'Hz',
});
```

| Opt        | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `min`      | Minimum allowed value                                                       |
| `max`      | Maximum allowed value                                                       |
| `step`     | Increment for stepping                                                      |
| `decimals` | Fixed number of decimal places shown; also infers `step` if not set         |
| `unit`     | Unit label shown beside the field; click increments, right-click decrements |

### `'text'`

Single-line text input. Default type when `type` is omitted.

```js
params('label', 'hello', { type: 'text' });
```

### `'textarea'`

Multi-line text input.

```js
params('script', '', { type: 'textarea' });
```

### `'color'`

Color picker with a hex text field. Value is a `#rrggbb` hex string.

```js
params('tint', '#ff6600', { type: 'color' });
```

Set `transparency: true` to enable an alpha channel. The value becomes a `#rrggbbaa` hex string and the widget gains an alpha slider with a checkerboard swatch.

```js
params('bg', '#000000ff', { type: 'color', transparency: true });
```

| Opt            | Description                                       |
| -------------- | ------------------------------------------------- |
| `transparency` | `true` to enable alpha channel (default: `false`) |

### `'checkbox'`

Boolean toggle.

```js
params('showGrid', false, { type: 'checkbox' });
```

### `'select'`

Dropdown. Requires an `options` array of string values.

```js
params('mode', 'wave', {
  type: 'select',
  options: ['wave', 'bars', 'circle'],
});
```

| Opt       | Description             |
| --------- | ----------------------- |
| `options` | Array of string choices |

### `'file'`

File picker button. Value is an absolute file path string, or `null` when cleared. Opens a system file dialog when clicked; a clear button removes the current selection.

```js
params('imagePath', '', { type: 'file' });
```

### `'image'`

Image file picker. Like `'file'` but adds a preview button: when a file is selected, clicking the preview button opens it in the system viewer; when no file is selected, it opens the picker instead.

```js
params('texture', null, { type: 'image', label: 'Texture' });
```

## Grouping parameters

Use `params.group(key, label, ...children)` to organize params into collapsible sections in the settings window. Children are individual param, combo, grid, or nested group objects. Groups can be nested.

```js
const hue = params('hue', 180, { type: 'number', min: 0, max: 360 });
const sat = params('sat', 80, { type: 'number', min: 0, max: 100 });
const spd = params('spd', 1.0, { type: 'number', min: 0, max: 5 });

const colorGroup = params.group('color', 'Color', hue, sat);
const motionGroup = params.group('motion', 'Motion', spd);
```

Top-level groups are expanded by default; nested groups are collapsed.

## Repeater

Use `params.repeater(key, defaults, field, opts)` to make a parameter hold a variable-length array. The settings window renders the list with **+** / **−** buttons to add and remove items. Items can be reordered by dragging the handle on the left.

```js
const color = params('color', '#ffffff', { type: 'color', label: 'Color' });
const colorList = params.repeater('colors', ['#ffffff'], color, {
  min: 1,
  max: 8,
});
```

| Argument   | Description                                                        |
| ---------- | ------------------------------------------------------------------ |
| `key`      | Storage key for the repeater array                                 |
| `defaults` | Initial array of values (padded to `opts.min` if shorter)          |
| `field`    | A param, combo, or grid object that defines each item's type       |
| `opts.min` | Minimum number of items (default: `0`)                             |
| `opts.max` | Maximum number of items, or `null` for unlimited (default: `null`) |

Reading repeater values:

```js
colorList.value; // full array copy: ['#ffffff', ...]
colorList.length; // current item count
colorList[0].value; // value of the first item
colorList[0].onChange(cb); // subscribe to changes on a specific item
```

## Combo

Use `params.combo(key, label, ...paramObjs)` to display multiple params as a single horizontal row in the settings window. Each `paramObj` is a regular `params()` result.

```js
const stopColor = params('stopColor', '#ffffff', {
  type: 'color',
  label: 'Color',
});
const stopPos = params('stopPos', 0, {
  type: 'number',
  min: 0,
  max: 1,
  step: 0.01,
  label: 'Pos',
});
const stop = params.combo('stop', 'Stop', stopColor, stopPos);
```

Pass a combo to `params.repeater()` to build a list of grouped rows (e.g. gradient stops):

```js
const stops = params.repeater(
  'stops',
  [{ stopColor: '#ffffff', stopPos: 0 }],
  stop,
  { min: 2 },
);

// Reading values:
stops.value; // [{ stopColor: '#ffffff', stopPos: 0 }, ...]
stops[0].value; // { stopColor: '#ffffff', stopPos: 0 }
```

Combo sub-params are **not** top-level keys in saved preset files. The whole repeater value is stored under the repeater key:

```json
{
  "stops": [
    { "stopColor": "#ffffff", "stopPos": 0 },
    { "stopColor": "#000000", "stopPos": 1 }
  ]
}
```

## Grid

Use `params.grid(key, columns, ...paramObjs)` to display multiple params in a CSS grid layout. The `columns` argument sets the number of grid columns. Individual params can span multiple columns via the `span` option.

```js
const r = params('r', 0, { type: 'number', min: 0, max: 255, label: 'R' });
const g = params('g', 128, { type: 'number', min: 0, max: 255, label: 'G' });
const b = params('b', 255, { type: 'number', min: 0, max: 255, label: 'B' });
const name = params('name', '', { type: 'text', label: 'Name', span: 3 });

const colorDef = params.grid('colorDef', 3, r, g, b, name);
```

Grid sub-params are **not** top-level keys in preset files. The composite value is stored under the grid key:

```json
{ "colorDef": { "r": 0, "g": 128, "b": 255, "name": "" } }
```

Pass a grid to `params.repeater()` to build a list of grid rows:

```js
const rows = params.repeater(
  'rows',
  [{ r: 0, g: 128, b: 255, name: '' }],
  colorDef,
  { min: 1 },
);
```

## Conditional visibility (`disabled`)

Any param, repeater, or group can be hidden based on the value of another param. Pass a `disabled` option to conditionally hide the control when a condition is met.

```js
const showGrid = params('showGrid', true, {
  type: 'checkbox',
  label: 'Show grid',
});

// Hide when showGrid is false
const gridSize = params('gridSize', 40, {
  type: 'number',
  label: 'Grid size',
  min: 4,
  max: 200,
  disabled: { param: showGrid, is: false },
});

// Hide when a select has a specific value
const mode = params('mode', 'full', {
  type: 'select',
  options: ['simple', 'full'],
});
params.group(
  'advancedGroup',
  'Advanced',
  { disabled: { param: mode, is: 'simple' } },
  params('detail', 8, { type: 'number', label: 'Detail', min: 1, max: 32 }),
);
```

| `disabled` form              | Hides when…                     |
| ---------------------------- | ------------------------------- |
| `'key'`                      | `params('key').value` is truthy |
| `paramObj`                   | `paramObj.value` is truthy      |
| `{ param: paramObj, is: v }` | `paramObj.value === v`          |

For groups, the options object `{ disabled: … }` is passed as the first argument after the label, before the child params.

---

## Full example

```js
export default function (p, audio, params) {
  const speed = params('speed', 1.0, {
    type: 'number',
    label: 'Speed',
    min: 0,
    max: 5,
    step: 0.1,
  });
  const color = params('color', '#ff6600', { type: 'color', label: 'Color' });
  const mode = params('mode', 'circle', {
    type: 'select',
    label: 'Shape',
    options: ['circle', 'square'],
  });

  params.group('controls', 'Controls', speed, color, mode);

  let angle = 0;

  p.setup = function () {
    p.createCanvas(p.windowWidth, p.windowHeight);
  };

  p.draw = function () {
    p.background(0);
    angle += speed.value * 0.02;
    p.fill(color.value);
    const x = p.width / 2 + Math.cos(angle) * 200;
    const y = p.height / 2 + Math.sin(angle) * 200;
    if (mode.value === 'circle') p.circle(x, y, 60);
    else p.rect(x - 30, y - 30, 60, 60);
  };
}
```

## Preset files

Preset files use a structured envelope that can carry both params and render settings:

```json
{
  "params": { "speed": 2.5, "color": "#00ffcc", "mode": "square" },
  "rendering": { "width": 1920, "height": 1080, "fps": 60 }
}
```

`rendering` is optional.

For combo and grid params, nested objects and flat dotted keys are both valid:

```json
{ "params": { "colorDef": { "r": 0, "g": 128, "b": 255 } } }
{ "params": { "colorDef.r": 0, "colorDef.g": 128, "colorDef.b": 255 } }
```

```sh
mp5 sketch.js audio.mp3 -p preset.json        # load from file
mp5 sketch.js audio.mp3 -P '{"speed": 2.5}'   # inline JSON
```

Both flags can be combined; `-P` values override `-p` values for the same key. Only values whose type matches the registered default are applied; mismatches are silently ignored.

The settings window has **Save** and **Load** buttons to export/import the current param values as a JSON preset file. **Save** always writes the structured envelope; **Load** applies any `rendering` values in the preset.
