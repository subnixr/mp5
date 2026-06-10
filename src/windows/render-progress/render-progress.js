const barFill = document.querySelector('#bar-fill');
const log = document.querySelector('#log');
const info = document.querySelector('#info');
const cancelBtn = document.querySelector('#cancel-btn');

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

window.api.onProgress((data) => {
  if (data.done) {
    barFill.style.width = '100%';
    log.textContent = data.success ? 'Done' : 'Render failed';
    cancelBtn.textContent = 'Close';
    cancelBtn.disabled = false;
    cancelBtn.addEventListener('click', () => window.close(), { once: true });
    return;
  }
  if (data.percent != null) barFill.style.width = data.percent.toFixed(1) + '%';
  if (data.line != null) log.textContent = data.line;
});
