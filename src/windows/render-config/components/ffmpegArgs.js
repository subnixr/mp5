import sheet from './ffmpegArgs.css' with { type: 'css' };
document.adoptedStyleSheets.push(sheet);

export default function FfmpegArgs(elem) {
  const header = document.createElement('div');
  header.classList.add('ffmpeg-header');

  const label = document.createElement('span');
  label.classList.add('label');
  label.textContent = 'ffmpeg args';

  const chevron = document.createElement('span');
  chevron.classList.add('ffmpeg-chevron');
  chevron.textContent = '▼';

  header.appendChild(chevron);
  header.appendChild(label);

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

  elem.style.gap = '0';
  elem.appendChild(header);
  elem.appendChild(content);

  let expanded = false;

  function setExpanded(val) {
    expanded = val;
    elem.classList.toggle('expanded', expanded);
    content.style.display = expanded ? '' : 'none';
    if (expanded) resizeTextarea();
  }

  header.addEventListener('click', () => setExpanded(!expanded));
  setExpanded(false);

  elem.textarea = textarea;

  function resizeTextarea() {
    textarea.style.height = '0';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  textarea.addEventListener('input', resizeTextarea);
  elem.resizeTextarea = resizeTextarea;

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
