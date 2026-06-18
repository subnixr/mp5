import sheet from './osd.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

export default function OSD(elem) {
  let hovered = false;
  let timer = null;
  let lastTimeout = null;

  elem.show = (timeout) => {
    lastTimeout = timeout || null;
    elem.classList.remove('hidden');
    clearTimeout(timer);
    if (lastTimeout) {
      timer = setTimeout(() => elem.hide(), lastTimeout);
    }
  };

  elem.hide = () => {
    clearTimeout(timer);
    if (hovered) return;
    elem.classList.add('hidden');
  };

  if (elem.hasAttribute('data-hover')) {
    elem.addEventListener('mouseenter', () => {
      hovered = true;
      clearTimeout(timer);
    });
    elem.addEventListener('mouseleave', () => {
      hovered = false;
      if (!elem.classList.contains('hidden')) {
        if (lastTimeout) {
          timer = setTimeout(() => elem.hide(), lastTimeout);
        }
      }
    });
  }

  return elem;
}
