import sheet from './ui.css' with { type: 'css' };
if (!document.adoptedStyleSheets.includes(sheet)) {
  document.adoptedStyleSheets.push(sheet);
}

export default function Button(elem) {
  elem.classList.add('btn');
  return elem;
}
