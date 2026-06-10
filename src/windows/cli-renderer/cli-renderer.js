import Engine from '../../components/engine.js';
import eq from '../visualizer/sketches/eq.js';
import { handleErrors } from '../error.js';

const engine = Engine(document.querySelector('#engine'));

async function importSketch(path) {
  if (path) {
    const url = 'file://' + path;
    const mod = await import(url);
    return mod.default;
  }
}

async function main() {
  handleErrors();

  const { sketchPath, audioPath, frameRate, mode, initialParams, startTime } =
    window.args;
  const sketch = await importSketch(sketchPath);

  if (initialParams && Object.keys(initialParams).length)
    engine.setInitialParams(initialParams);

  engine.setRenderFps(frameRate);
  engine.setStartTime(startTime ?? 0);
  await engine.loadAudio(audioPath); // loads + pre-computes; sketch awaits this internally
  await engine.loadSketch(sketch ?? eq);

  if (mode === 'render') {
    // Switch p5 to explicit step mode: one p.redraw() per render-next IPC.
    // This ties animation frames 1:1 to ffmpeg frames, independent of display
    // refresh rate or rAF timing.
    const p = engine.getInstance();
    p.noLoop();
    window.api.onRenderNext((_e) => p.redraw());
    window.api.notifyReady(); // main process sends first render-next, pipeline starts
  }
}

main();
