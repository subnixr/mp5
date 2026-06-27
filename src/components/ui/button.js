import sheet from './ui.css' with { type: 'css' };
import { iconSpan } from './inputs.js';
if (!document.adoptedStyleSheets.includes(sheet)) {
  document.adoptedStyleSheets.push(sheet);
}

// decorate an existing element (Button(elem)) or build a fresh button from
// options (Button({ icon, label, onClick })); both return the .btn element
export default function Button(elemOrOpts) {
  if (elemOrOpts instanceof HTMLElement) {
    elemOrOpts.classList.add('btn');
    return elemOrOpts;
  }

  const { icon, label, onClick, type = 'button' } = elemOrOpts ?? {};
  const btn = document.createElement('button');
  btn.type = type;
  btn.classList.add('btn');
  if (icon) btn.appendChild(iconSpan(icon));
  if (label != null) {
    const span = document.createElement('span');
    span.textContent = label;
    btn.appendChild(span);
  }
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
