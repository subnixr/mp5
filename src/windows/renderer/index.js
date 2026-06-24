import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';
import { resolveBinary } from '../../binaries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FORMAT_PRESETS = {
  mp4: '-c:v libx264 -pix_fmt yuv420p',
  mov: '-c:v prores_ks -pix_fmt yuva444p10le',
  webm: '-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0',
};

function progressFromFfmpeg(block, totalFrames, fps) {
  const data = {};
  for (const line of block) {
    const eq = line.indexOf('=');
    if (eq !== -1) data[line.slice(0, eq)] = line.slice(eq + 1);
  }

  const frame = parseInt(data.frame) || 0;
  const percent = totalFrames != null ? (frame / totalFrames) * 100 : null;

  const speedStr = data.speed ?? '';
  const speed = speedStr.endsWith('x') ? parseFloat(speedStr) : null;

  let etaSec = null;
  if (speed != null && speed > 0 && totalFrames != null) {
    const outTimeSec = parseInt(data.out_time_us ?? 0) / 1e6;
    const totalDuration = totalFrames / fps;
    etaSec = Math.max(0, (totalDuration - outTimeSec) / speed);
  }

  return { percent, etaSec, speed };
}

function formatProgress({ percent, etaSec, speed }, filename) {
  const pct = percent != null ? percent.toFixed(1) + '%' : '--%';

  let eta = '--:--';
  if (etaSec != null) {
    const t = Math.round(etaSec);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    eta =
      h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
  }

  const spd = speed != null ? speed.toFixed(1) + 'x' : '--';

  return `${pct} ${spd} ETA ${eta}`;
}

function setupFrameCapture(
  webContents,
  args,
  totalFrames,
  { onProgress, onDone },
) {
  let ffmpegProcess = null;
  let frameCount = 0;
  let done = false;
  // Discard paint events until renderer signals it's in noLoop mode and ready.
  let ready = false;
  // Actual canvas backing-store size (HiDPI displays make this larger than
  // args.width×height). ffmpeg must read raw frames at this size, then scale
  // down to the requested output size via the -vf scale filter.
  let captureWidth = args.width;
  let captureHeight = args.height;
  const filename = path.basename(args.output);

  const onReady = (_event, dims) => {
    if (dims?.width > 0 && dims?.height > 0) {
      captureWidth = dims.width;
      captureHeight = dims.height;
    }
    ready = true;
    webContents.send('render-next');
  };
  ipcMain.once('renderer-ready', onReady);

  const onFrame = (_event, buffer) => {
    if (done || !ready) return;

    const width = captureWidth;
    const height = captureHeight;

    if (!ffmpegProcess) {
      const ffArgs = [
        '-f',
        'rawvideo',
        '-pixel_format',
        'rgba',
        '-video_size',
        `${width}x${height}`,
        '-framerate',
        String(args.frameRate),
        '-i',
        'pipe:0',
      ];
      if (args.audioPath) {
        if (args.startTime) ffArgs.push('-ss', String(args.startTime));
        ffArgs.push('-i', args.audioPath);
      }
      if (totalFrames != null) {
        ffArgs.push('-frames:v', String(totalFrames));
      }
      ffArgs.push('-vf', `scale=${args.width}:${args.height},format=yuva420p`);
      const extraStr = args.ffmpegExtra ?? process.env.MP5_FFMPEG_EXTRA ?? null;
      let extra;
      if (extraStr) {
        extra = extraStr.trim().split(/\s+/).filter(Boolean);
      } else {
        const ext = path.extname(args.output).toLowerCase().slice(1);
        const preset = FORMAT_PRESETS[ext] ?? FORMAT_PRESETS.mp4;
        extra = preset.trim().split(/\s+/).filter(Boolean);
      }
      ffArgs.push(
        ...extra,
        '-progress',
        'pipe:1',
        '-nostats',
        '-y',
        args.output,
      );

      ffmpegProcess = spawn(resolveBinary('ffmpeg'), ffArgs);
      ffmpegProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));
      ffmpegProcess.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') throw err;
      });

      let pending = '';
      let block = [];
      ffmpegProcess.stdout.on('data', (chunk) => {
        const lines = (pending + chunk).split('\n');
        pending = lines.pop();
        for (const line of lines) {
          if (line.startsWith('progress=')) {
            const end = line === 'progress=end';
            const stats = progressFromFfmpeg(
              block,
              totalFrames,
              args.frameRate,
            );
            if (end && stats.percent != null) stats.percent = 100;
            onProgress({ ...stats, line: formatProgress(stats, filename) });
            block = [];
          } else {
            block.push(line);
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) process.stderr.write(`\nffmpeg exited (${code})\n`);
        done = true;
        ipcMain.off('renderer-frame', onFrame);
        onDone(code === 0);
      });
    }

    if (!ffmpegProcess.stdin.writable) return;

    const ok = ffmpegProcess.stdin.write(Buffer.from(buffer));
    frameCount++;

    if (totalFrames != null && frameCount >= totalFrames) {
      done = true;
      ffmpegProcess.stdin.end();
      return;
    }

    // Send render-next to trigger the next p.redraw() in the renderer.
    // If stdin buffer is full, wait for drain first (backpressure).
    if (!ok) {
      ffmpegProcess.stdin.once('drain', () => {
        if (!done) webContents.send('render-next');
      });
    } else {
      webContents.send('render-next');
    }
  };
  ipcMain.on('renderer-frame', onFrame);

  return {
    cancel: () => {
      if (!done) {
        done = true;
        ipcMain.off('renderer-ready', onReady);
        ipcMain.off('renderer-frame', onFrame);
        ffmpegProcess?.kill();
      }
    },
  };
}

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveBinary('ffprobe'), [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);
    let out = '';
    proc.stdout.on('data', (d) => {
      out += d;
    });
    proc.on('close', (code) => {
      if (code === 0) resolve(parseFloat(out));
      else reject(new Error(`ffprobe exited ${code}`));
    });
  });
}

async function prepareRenderArgs(args) {
  if (args.audioPath && (args.length == null || args.length <= 0)) {
    const audioDur = await getAudioDuration(args.audioPath);
    args.length = audioDur - (args.startTime ?? 0);
  }
  // null length = open-ended render (mic mode). A non-finite length (e.g.
  // ffprobe returned "N/A") must NOT slip through as a frame cap, or the
  // render never stops — clamp it back to null and surface the failure.
  const frames =
    args.length != null ? Math.ceil(args.length * args.frameRate) : null;
  const totalFrames = Number.isFinite(frames) ? frames : null;
  if (frames != null && totalFrames == null)
    process.stderr.write(
      `\n[mp5] could not determine audio duration; rendering open-ended\n`,
    );
  return totalFrames;
}

function createRendererWindow(args) {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      offscreen: true,
    },
  });

  relayConsole(win.webContents, 'renderer');

  win.setContentSize(args.width, args.height);
  win.webContents.setFrameRate(args.frameRate);

  return win;
}

export async function runRender(args) {
  const totalFrames = await prepareRenderArgs(args);
  const filename = path.basename(args.output);

  const win = createRendererWindow(args);

  const prefix = `[ffmpeg ${args.output}] `;

  setupFrameCapture(win.webContents, args, totalFrames, {
    onProgress: (d) => process.stderr.write('\r\x1b[K' + prefix + d.line),
    onDone: (ok) => {
      if (!ok) process.stderr.write(`\nffmpeg exited with error\n`);
      else
        process.stderr.write(
          '\r\x1b[K' +
            prefix +
            formatProgress({ percent: 100, etaSec: 0, speed: null }, filename) +
            '\n',
        );
      app.quit();
    },
  });

  win.loadFile(path.join(__dirname, 'renderer.html'), {
    query: { args: JSON.stringify(args) },
  });
}

export async function runRenderWithProgress(args, { onProgress, onDone }) {
  const totalFrames = await prepareRenderArgs(args);

  const win = createRendererWindow(args);

  const { cancel: cancelCapture } = setupFrameCapture(
    win.webContents,
    args,
    totalFrames,
    {
      onProgress,
      onDone: (ok) => {
        if (!win.isDestroyed()) win.destroy();
        onDone(ok);
      },
    },
  );

  win.loadFile(path.join(__dirname, 'renderer.html'), {
    query: { args: JSON.stringify(args) },
  });

  return {
    cancel: () => {
      cancelCapture();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
