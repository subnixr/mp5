import Button from '../../components/ui/button.js';
import { Field } from '../../components/ui/inputs.js';

const barFill = document.querySelector('#bar-fill');
const log = document.querySelector('#log');
const info = document.querySelector('#info');
const renderOpts = document.querySelector('#render-opts');
const cancelBtn = Button(document.querySelector('#cancel-btn'));
const openFolderBtn = Button(document.querySelector('#open-folder-btn'));
const returnBtn = Button(document.querySelector('#return-btn'));
const closeAppBtn = Button(document.querySelector('#close-app-btn'));

const quitOnFinish = Field({
  type: 'checkbox',
  key: 'quitOnFinish',
  label: 'Quit on finish',
  value: false,
});
const openFolderOnFinish = Field({
  type: 'checkbox',
  key: 'openFolderOnFinish',
  label: 'Open folder on finish',
  value: false,
});
renderOpts.appendChild(quitOnFinish);
renderOpts.appendChild(openFolderOnFinish);

function infoLine(label, value) {
  if (!value) return;
  const div = document.createElement('div');
  div.className = 'info-line';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'info-label';
  labelSpan.textContent = label;
  div.appendChild(labelSpan);
  div.appendChild(document.createTextNode(value));
  info.appendChild(div);
}

if (window.args.output) {
  const div = document.createElement('div');
  div.className = 'info-line info-output';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'info-label';
  labelSpan.textContent = 'output: ';
  div.appendChild(labelSpan);
  div.appendChild(document.createTextNode(window.args.output));
  info.appendChild(div);
}
infoLine('sketch: ', window.args.sketchPath);
infoLine('audio: ', window.args.audioPath);

cancelBtn.addEventListener('click', () => {
  cancelBtn.disabled = true;
  window.api.cancelRender();
});

openFolderBtn.addEventListener('click', () => window.api.openOutputFolder());
returnBtn.addEventListener('click', () => window.api.returnToAnimation());
closeAppBtn.addEventListener('click', () => window.api.quitApp());

window.api.onProgress((data) => {
  if (data.done) {
    barFill.style.width = '100%';
    log.textContent = data.success ? 'Done' : 'Render failed';
    renderOpts.style.display = 'none';
    if (data.success && quitOnFinish.getValue()) {
      if (openFolderOnFinish.getValue()) window.api.openOutputFolder();
      window.api.quitApp();
      return;
    }
    if (data.success && openFolderOnFinish.getValue())
      window.api.openOutputFolder();
    cancelBtn.style.display = 'none';
    openFolderBtn.style.display = '';
    returnBtn.style.display = '';
    closeAppBtn.style.display = '';
    return;
  }
  if (data.percent != null) barFill.style.width = data.percent.toFixed(1) + '%';
  if (data.line != null) log.textContent = data.line;
});
