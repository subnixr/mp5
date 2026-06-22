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

## `params.canvas(W, H)`

Declare preferred canvas size. Call once at the top of the sketch function, before `p.setup`.

- Visualizer window requests resize to W×H on sketch load (window manager has final say).
- Render settings W/H fields default to these values.
- Overridden by `-g WxH` CLI flag or a preset that specifies `rendering.width/height`.
- Sketches with no size preference (e.g. the built-in `eq.js`) omit the call.

sketches are based on p5 but always rely on the engine api.

time in a sketch is always dependent on the current input of the engine: if input is mic, then is wall-clock/IRL time. if input is file, then time is track's current time.

for file input, time is bound to track current time in order to make animations deterministic. rember that time can be paused, resumed, rewinded or skipped.

**All time-based logic in sketches MUST use `audio.currentTime()` (or `audio.millis()`), never `p.deltaTime`, `p.millis()`, or wall-clock equivalents.** Using p5 time breaks pause/resume/scrub determinism for file inputs.

**Sketch animations must be pure and data-dependent: animation state is computed from `audio.currentTime()` each frame, not accumulated from frame-to-frame deltas.** Avoid one-shot flags, mutable phase state, or anything that makes the visual output depend on playback history. If scrubbing to any point in time and rendering one frame produces the wrong result, the animation is not pure.

# Component Pattern

when building dom UIs, always use the component pattern found in visualizer.js
Components are functions that accept just the element, which is also the return itself. The component can decorate the element if needed, along with other stuff needed. Components can be nested.

Always reuse `src/components/ui/` components for any input element (buttons, sliders, text inputs, selects, etc.) — never create raw `<input>`, `<button>`, `<select>` elements directly. If the needed input type is missing from `src/components/ui/`, add it there first, then use it.

# Misc

- default font size in DOM should be 16px
- window background color is `#000000` (black), defined in `src/components/base.css`
- avoid `!important` in CSS; fix specificity instead
