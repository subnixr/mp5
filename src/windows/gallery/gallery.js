import * as Input from '../../components/ui/inputs.js';

import sheet from './gallery.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

function SketchCard(filePath, name, enabled, previewDir, previewPath) {
  const card = document.createElement('div');
  card.className = 'sketch-card';

  const img = document.createElement('img');
  img.className = 'card-preview';
  img.src = previewPath
    ? `file://${previewPath}`
    : `file://${previewDir}/${name}.jpg`;
  img.alt = '';
  img.addEventListener('error', () => {
    img.style.display = 'none';
  });
  card.appendChild(img);

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = name;
  card.appendChild(title);

  const check = Input.Checkbox({ value: enabled });
  check.classList.add('card-check');
  card.appendChild(check);

  card.addEventListener('click', (evt) => {
    if (check.contains(evt.target)) return;
    window.api.updateGallerySettings({ switchToPath: filePath });
  });

  card.getEnabled = () => check.getValue();
  card.setEnabled = (v) => check.setValue(v);
  card.filePath = filePath;
  return card;
}

function GalleryPanel(elem) {
  const grid = document.createElement('div');
  grid.className = 'sketch-grid';
  elem.appendChild(grid);

  const controls = document.createElement('div');
  controls.className = 'gallery-controls';

  const shuffleField = Input.Field(
    { key: 'shuffle', label: 'Shuffle', type: 'checkbox', value: false },
    (_key, v) => window.api.updateGallerySettings({ shuffle: v }),
  );
  controls.appendChild(shuffleField);

  const autoplayField = Input.Field(
    {
      key: 'autoplay',
      label: 'Autoplay (s)',
      type: 'number',
      min: 0,
      step: 1,
      value: 0,
    },
    (_key, v) => window.api.updateGallerySettings({ autoplay: v }),
  );
  controls.appendChild(autoplayField);

  elem.appendChild(controls);

  let cards = [];

  function emitEnabledPaths() {
    window.api.updateGallerySettings({
      enabledPaths: cards.filter((c) => c.getEnabled()).map((c) => c.filePath),
    });
  }

  elem.applyState = (state) => {
    shuffleField.setValue(state.shuffle ?? false);
    autoplayField.setValue(state.autoplay ?? 0);

    const enabledSet = new Set(state.enabledPaths ?? state.paths ?? []);
    grid.replaceChildren();
    cards = (state.paths ?? []).map((p) => {
      const name = state.names?.[p] ?? p.split('/').pop().replace(/\.js$/, '');
      const card = SketchCard(
        p,
        name,
        enabledSet.has(p),
        state.previewDir,
        state.previews?.[p],
      );
      card
        .querySelector('.card-check')
        .addEventListener('change', emitEnabledPaths);
      grid.appendChild(card);
      return card;
    });
  };

  return elem;
}

const panel = GalleryPanel(document.querySelector('#gallery-panel'));
window.api.onGalleryStatePush((state) => panel.applyState(state));
