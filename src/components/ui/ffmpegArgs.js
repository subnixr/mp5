import sheet from './ffmpegArgs.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

import { Label } from './inputs.js';

export default function FfmpegArgs(elem) {
  const content = document.createElement('div');
  content.id = 'ffmpeg-args';

  const preDiv = document.createElement('div');
  preDiv.classList.add('ffmpeg-fixed', 'ffmpeg-fixed-pre');

  const textarea = document.createElement('textarea');
  textarea.id = 'ffmpeg-extra';
  textarea.spellcheck = false;

  const sufDiv = document.createElement('div');
  sufDiv.classList.add('ffmpeg-fixed', 'ffmpeg-fixed-suf');

  content.appendChild(preDiv);
  content.appendChild(textarea);
  content.appendChild(sufDiv);

  function resizeTextarea() {
    textarea.style.height = '0';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  textarea.addEventListener('input', resizeTextarea);
  elem.resizeTextarea = resizeTextarea;

  const header = Label(document.createElement('div'), {
    collapsible: true,
    label: 'ffmpeg args',
    open: false,
    onExpand: resizeTextarea,
  });
  header.setTarget(content);

  elem.appendChild(header);
  elem.appendChild(content);

  elem.textarea = textarea;

  elem.updateFixed = ({ w, h, fps, audio, skip, length, output }) => {
    const pre = [
      '-f rawvideo',
      '-pixel_format rgba',
      `-video_size ${w}x${h}`,
      `-framerate ${fps}`,
      '-i pipe:0',
    ];
    if (audio) {
      if (skip) pre.push(`-ss ${skip}`);
      pre.push(`-i <${audio}>`);
    }
    if (length != null) pre.push(`-frames:v ${Math.ceil(length * fps)}`);
    pre.push(`-vf scale=${w}:${h},format=yuva420p`);
    preDiv.textContent = pre.join('\n') + '\n';

    const suf = ['-progress pipe:1', '-nostats', '-y', output || '<output>'];
    sufDiv.textContent = suf.join('\n');
  };

  return elem;
}
