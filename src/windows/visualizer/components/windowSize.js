import sheet from './windowSize.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

export default function WindowSize(elem) {
  let hideTimer = null;

  function updateSize() {
    elem.textContent = `${window.innerWidth} × ${window.innerHeight}`;
    elem.dataset.display = '';

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      delete elem.dataset.display;
    }, 3000);
  }

  window.addEventListener('resize', updateSize);

  return elem;
}
