import sheet from './windowSize.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

import * as Input from '../../../components/ui/inputs.js';

export default function WindowSize(elem) {
  let hideTimer = null;
  let hovered = false;

  const label = document.createElement('span');

  const ctrl = Input.Text({ value: '' });
  const input = ctrl.querySelector('input');
  const inputWrap = document.createElement('div');
  inputWrap.className = 'input';
  inputWrap.appendChild(ctrl);

  elem.appendChild(label);
  elem.appendChild(inputWrap);

  function currentText() {
    return `${window.innerWidth}x${window.innerHeight}`;
  }

  function showFor(ms) {
    elem.dataset.display = '';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!hovered) delete elem.dataset.display;
    }, ms);
  }

  function enterEdit() {
    ctrl.setValue(currentText());
    elem.dataset.editing = '';
    input.focus();
    input.select();
  }

  function exitEdit(submit) {
    if (!('editing' in elem.dataset)) return;
    delete elem.dataset.editing;

    if (submit) {
      const match = input.value.match(/(\d+)\s*[×x\s]\s*(\d+)/);
      if (match) {
        const w = parseInt(match[1], 10);
        const h = parseInt(match[2], 10);
        if (w > 0 && h > 0)
          elem.dispatchEvent(
            new CustomEvent('resize-request', { detail: { w, h } }),
          );
      }
    }

    label.textContent = currentText();
    showFor(1000);
  }

  function stopBubble(event) {
    event.stopPropagation();
  }

  input.addEventListener('keydown', stopBubble);
  input.addEventListener('keyup', stopBubble);
  input.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') exitEdit(true);
    else if (event.key === 'Escape') exitEdit(false);
  });
  input.addEventListener('blur', () => exitEdit(false));

  elem.addEventListener('mouseenter', () => {
    hovered = true;
    clearTimeout(hideTimer);
    if (!('editing' in elem.dataset)) {
      label.textContent = currentText();
      elem.dataset.display = '';
    }
  });

  elem.addEventListener('mouseleave', () => {
    hovered = false;
    if ('display' in elem.dataset) showFor(1000);
  });

  elem.addEventListener('click', () => {
    if (!('editing' in elem.dataset)) enterEdit();
  });

  window.addEventListener('resize', () => {
    if (!('editing' in elem.dataset)) {
      label.textContent = currentText();
      showFor(1000);
    }
  });

  return elem;
}
