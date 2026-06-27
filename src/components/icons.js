fetch(new URL('../assets/icons.svg', document.currentScript.src))
  .then(r => r.text())
  .then(t => document.body.insertAdjacentHTML('afterbegin', t));
