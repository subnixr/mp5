import Engine from '../../components/engine/index.js';
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

  console.log('loading audio');
  await engine.loadAudio(audioPath); // loads + pre-computes; sketch awaits this internally
  await engine.loadSketch(sketch ?? eq);

  if (mode === 'render') {
    // Switch p5 to explicit step mode: one p.redraw() per render-next IPC.
    // This ties animation frames 1:1 to ffmpeg frames, independent of display
    // refresh rate or rAF timing.
    const p = engine.getInstance();
    const { canvas } = p;
    const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx2d = offscreen.getContext('2d', { willReadFrequently: true });
    p.noLoop();
    window.api.onRenderNext((_e) => {
      p.redraw();
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(canvas, 0, 0);
      const { data } = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
      window.api.sendFrame(data.buffer);
    });
    window.api.notifyReady(); // main process sends first render-next, pipeline starts
  }
}

main();
