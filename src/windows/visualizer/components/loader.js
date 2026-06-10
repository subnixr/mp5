import sheet from './loader.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

export default function Loader(elem) {
  elem.hide = () => {
    elem.style.display = 'none';
  };

  return elem;
}
