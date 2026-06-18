# Project name: MP5

## Quick facts

- **Stack**: Electron, Electron builder, p5.js

## Key paths

- `src/index.js`: entry point
- `src/assets/`: non-code assets
- `src/windows/$window/`: window definition
  - `index.js`: module for node side of electron
  - `$window.html`: file loaded by window
  - `$window.js`: window document entry point

## Code Style & Rules

- Prefer function style for application
- use imperative style only in sketches if functional introduces too much overhead
- top level functions should be declared with `function` keyboard
- group code into functions, reduce at maximum istructions outside of functions.
- respect semantic emtpy lines

# Sketches

sketch path passed to `mp5` can be a `.js` file or a directory (directory is resolved by the engine to locate the sketch entry point).

sketches are based on p5 but always rely on the engine api.

time in a sketch is always dependent on the current input of the engine: if input is mic, then is wall-clock/IRL time. if input is file, then time is track's current time.

for file input, time is bound to track current time in order to make animations deterministic. rember that time can be paused, resumed, rewinded or skipped.

# Component Pattern

when building dom UIs, always use the component pattern found in visualizer.js
Components are functions that accept just the element, which is also the return itself. The component can decorate the element if needed, along with other stuff needed. Components can be nested.

Always reuse `src/components/ui/` components for any input element (buttons, sliders, text inputs, selects, etc.) — never create raw `<input>`, `<button>`, `<select>` elements directly. If the needed input type is missing from `src/components/ui/`, add it there first, then use it.

# Misc

- default font size in DOM should be 16px
- window background color is `#000000` (black), defined in `src/components/base.css`
- avoid `!important` in CSS; fix specificity instead
