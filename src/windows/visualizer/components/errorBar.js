import sheet from './errorBar.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

export default function ErrorBar(elem) {
  let currentMessage = '';

  elem.setMessage = (msg) => {
    currentMessage = msg;
    elem.innerHTML = '';
    elem.innerText = msg;
  };

  elem.addEventListener('click', () => {
    window.api.writeClipboard(currentMessage);
    elem.hide();
  });

  elem.show = () => {
    elem.style.display = 'block';
  };

  elem.hide = () => {
    elem.style.display = 'none';
  };

  return elem;
}
