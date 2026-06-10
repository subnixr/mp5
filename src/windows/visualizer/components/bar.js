import barSketch from '../sketches/bar.js';

export default function Bar(elem) {
  const state = {
    fileVizMode: 'seek',
    engine: null,
    container: elem,
    hoverX: null,
  };

  new p5((p) => barSketch(p, state), elem);

  new ResizeObserver(() => state.resize?.()).observe(elem);

  function emitSeek(clientX) {
    if (state.engine?.getMode() !== 'file') return;
    if (state.fileVizMode !== 'seek') return;
    const rect = elem.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    elem.dispatchEvent(new CustomEvent('seek', { detail: ratio }));
  }

  elem.addEventListener('click', (evt) => {
    emitSeek(evt.clientX);
  });

  elem.addEventListener('mousemove', (evt) => {
    const rect = elem.getBoundingClientRect();
    state.hoverX = evt.clientX - rect.left;
  });

  elem.addEventListener('mouseleave', () => {
    state.hoverX = null;
  });

  elem.attach = (engine) => {
    state.engine = engine;
  };

  elem.setMode = (mode) => {
    state.fileVizMode = mode;
  };

  return elem;
}
