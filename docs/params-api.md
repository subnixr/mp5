# Params API

Params let a sketch declare runtime-tweakable values. When a sketch defines params, the settings window (opened via the controls bar or `F12`) renders the corresponding UI controls. Values are editable in real time, persist across sketch reloads, and can be pre-seeded from the CLI.

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
```

| Opt        | Description                                                         |
| ---------- | ------------------------------------------------------------------- |
| `min`      | Minimum allowed value                                               |
| `max`      | Maximum allowed value                                               |
| `step`     | Increment for the input stepper                                     |
| `decimals` | Fixed number of decimal places shown; also infers `step` if not set |

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

File picker button. Value is an absolute file path string. Opens a system file dialog when clicked.

```js
params('imagePath', '', { type: 'file' });
```

## Grouping parameters

Use `params.group(title, obj)` to organize params into collapsible sections in the settings window. Groups can be nested.

```js
const hue = params('hue', 180, { type: 'number', min: 0, max: 360 });
const sat = params('sat', 80, { type: 'number', min: 0, max: 100 });
const spd = params('spd', 1.0, { type: 'number', min: 0, max: 5 });

const colorGroup = params.group('Color', { hue, sat });
const motionGroup = params.group('Motion', { spd });
```

Top-level groups are expanded by default; nested groups are collapsed.

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

  params.group('Controls', { speed, color, mode });

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

Params can be pre-seeded from a JSON object mapping param keys to values:

```json
{ "speed": 2.5, "color": "#00ffcc", "mode": "square" }
```

```sh
mp5 sketch.js audio.mp3 -p preset.json        # load from file
mp5 sketch.js audio.mp3 -P '{"speed": 2.5}'   # inline JSON
```

Both flags can be combined; `-P` values override `-p` values for the same key. Only values whose type matches the registered default are applied; mismatches are silently ignored.

The settings window also has **Save** and **Load** buttons to export/import the current param values as a JSON preset file.
