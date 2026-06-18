import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';
import { openSettingsWindow } from '../settings/index.js';
import { openGalleryWindow } from '../gallery/index.js';
import { openRenderProgressWindow } from '../progress/index.js';
import { runRenderWithProgress } from '../renderer/index.js';

function extractZipSketch(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
  const entry = path.join(destDir, 'sketch.js');
  return fs.existsSync(entry) ? entry : null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function watchFileDebounced(filePath, onChanged) {
  let timer = null;
  let watcher = null;

  function start() {
    try {
      watcher = fs.watch(filePath, (eventType) => {
        clearTimeout(timer);
        if (eventType === 'rename') {
          watcher.close();
          timer = setTimeout(() => {
            start();
            onChanged();
          }, 200);
        } else {
          timer = setTimeout(onChanged, 100);
        }
      });
    } catch (_) {}
  }

  start();
  return {
    close: () => {
      clearTimeout(timer);
      watcher?.close();
    },
  };
}

export function runVisualizer(args) {
  let galleryDir = null;
  let galleryPaths = [];
  let galleryNames = {};
  if (args.sketchPath) {
    const stat = fs.statSync(args.sketchPath, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      galleryDir = args.sketchPath;
      const tmpDir = path.join(os.tmpdir(), `mp5-${process.pid}`);

      for (const entry of fs.readdirSync(galleryDir).sort()) {
        if (entry.startsWith('.')) continue;
        const full = path.join(galleryDir, entry);
        const entryStat = fs.statSync(full, { throwIfNoEntry: false });

        if (entry.endsWith('.zip')) {
          const name = entry.slice(0, -4);
          const extractDir = path.join(tmpDir, name);
          fs.mkdirSync(extractDir, { recursive: true });
          const entryJs = extractZipSketch(full, extractDir);
          if (entryJs) {
            galleryPaths.push(entryJs);
            galleryNames[entryJs] = name;
          }
        } else if (entryStat?.isDirectory()) {
          const entryJs = path.join(full, 'sketch.js');
          if (fs.existsSync(entryJs)) {
            galleryPaths.push(entryJs);
            galleryNames[entryJs] = entry;
          }
        }
      }

      args.sketchPath = galleryPaths[0] ?? null;
      args.galleryDir = galleryDir;
      args.galleryPaths = galleryPaths;
      args.galleryNames = galleryNames;
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: args.fullscreen,
    title: ['mp5', args.sketchPath, args.audioPath]
      .filter((b) => b)
      .join(' - '),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // hide menu
  win.setMenu(null);
  win.setMenuBarVisibility(false);

  if (process.env.MP5_DEBUG) win.webContents.openDevTools();

  // relay page console to terminal
  relayConsole(win.webContents, 'window');

  // setup fullscreen
  const onToggleFullscreen = () => win.setFullScreen(!win.isFullScreen());

  win.on('enter-full-screen', () =>
    win.webContents.send('fullscreen-changed', true),
  );
  win.on('leave-full-screen', () =>
    win.webContents.send('fullscreen-changed', false),
  );

  ipcMain.on('toggle-fullscreen', onToggleFullscreen);

  const onResizeWindow = (_e, w, h) => {
    if (!win.isDestroyed()) win.setSize(Math.round(w), Math.round(h));
  };
  ipcMain.on('resize-window', onResizeWindow);

  let settingsWin = null;
  let galleryWin = null;

  const onOpenGallery = () => {
    if (galleryWin && !galleryWin.isDestroyed()) {
      galleryWin.focus();
      return;
    }
    galleryWin = openGalleryWindow(win);
    galleryWin.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed()) win.webContents.send('push-gallery-state-request');
    });
    galleryWin.on('closed', () => {
      galleryWin = null;
    });
  };

  ipcMain.on('open-gallery', onOpenGallery);

  const onOpenSettings = (_e, defs) => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.focus();
      return;
    }
    const audioBase = args.audioPath
      ? path.basename(args.audioPath, path.extname(args.audioPath))
      : null;
    settingsWin = openSettingsWindow({ ...defs, audioBase, initialRendering: args.initialRendering ?? null }, win);
    settingsWin.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed())
        win.webContents.send('push-gallery-state-request');
    });
    settingsWin.on('closed', () => {
      settingsWin = null;
    });
  };

  ipcMain.on('open-settings', onOpenSettings);

  const AUDIO_EXTS = ['mp3', 'ogg', 'wav', 'aac', 'flac', 'm4a'];

  let audioWatcher = null;

  const onOpenAudioPicker = async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: AUDIO_EXTS }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const newPath = result.filePaths[0];
    args.audioPath = newPath;
    if (audioWatcher) audioWatcher.close();
    audioWatcher = watchFileDebounced(newPath, () => {
      if (!win.isDestroyed()) win.webContents.send('audio-changed');
    });
    return newPath;
  };

  ipcMain.handle('open-audio-picker', onOpenAudioPicker);

  const onOpenSketchPicker = async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Sketch', extensions: ['js', 'zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const picked = result.filePaths[0];

    let entryPath = picked;
    let displayName;

    if (picked.endsWith('.zip')) {
      const zipName = path.basename(picked, '.zip');
      const tmpDir = path.join(os.tmpdir(), `mp5-${process.pid}`, 'picker');
      fs.mkdirSync(tmpDir, { recursive: true });
      entryPath =
        extractZipSketch(picked, path.join(tmpDir, zipName)) ?? picked;
      displayName = zipName;
      args.sketchSourcePath = picked;
      args.sketchDisplayName = zipName;
    } else {
      displayName = path.basename(picked, '.js');
      args.sketchSourcePath = null;
      args.sketchDisplayName = null;
    }

    args.sketchPath = entryPath;
    watchers.forEach((w) => w.close());
    watchers.length = 0;
    watchers.push(
      watchFileDebounced(entryPath, () => {
        if (!win.isDestroyed()) win.webContents.send('sketch-changed');
      }),
    );
    return { path: entryPath, displayName };
  };

  ipcMain.handle('open-sketch-picker', onOpenSketchPicker);

  const onOpenSketchInEditor = (_e) => {
    const source = args.sketchSourcePath ?? args.sketchPath;
    const target = source?.endsWith('.zip') ? path.dirname(source) : source;
    if (target) shell.openPath(target);
  };

  ipcMain.on('open-sketch-in-editor', onOpenSketchInEditor);

  const onTriggerRender = async (_e, { params, rendering, output }) => {
    const sketchBase = args.sketchPath
      ? path.basename(args.sketchPath, '.js')
      : null;
    const audioBase = args.audioPath ? path.basename(args.audioPath) : null;
    const titleParts = ['mp5 - renderer', sketchBase, audioBase].filter(Boolean);
    const title = titleParts.join(' - ');

    const renderArgs = {
      ...args,
      mode: 'render',
      output,
      frameRate: rendering.frameRate,
      ffmpegExtra: rendering.ffmpegExtra,
      width: rendering.width,
      height: rendering.height,
      startTime: rendering.startTime ?? 0,
      length: rendering.length ?? null,
      initialParams: params,
    };

    const renderRef = { cancel: null };

    const progressWin = openRenderProgressWindow({
      title,
      sketchPath: args.sketchPath,
      audioPath: args.audioPath,
      output,
      onCancel: () => {
        renderRef.cancel?.();
        runVisualizer({ ...args, initialParams: params });
      },
      onReturnToAnimation: () => {
        runVisualizer({ ...args, initialParams: params });
      },
    });

    // close child windows before visualizer so window-all-closed isn't triggered
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
    if (galleryWin && !galleryWin.isDestroyed()) galleryWin.close();
    win.close();

    const { cancel } = await runRenderWithProgress(renderArgs, {
      onProgress: (data) => progressWin.sendProgress(data),
      onDone: (success) => progressWin.sendProgress({ done: true, success }),
    });
    renderRef.cancel = cancel;
  };

  ipcMain.handle('trigger-render', onTriggerRender);

  const watchers = [];

  if (args.sketchPath) {
    watchers.push(
      watchFileDebounced(args.sketchPath, () => {
        if (!win.isDestroyed()) win.webContents.send('sketch-changed');
      }),
    );
  }

  if (args.audioPath) {
    audioWatcher = watchFileDebounced(args.audioPath, () => {
      if (!win.isDestroyed()) win.webContents.send('audio-changed');
    });
  }

  const onSetWatchSketch = (_e, newPath) => {
    watchers.forEach((w) => w.close());
    watchers.length = 0;
    watchers.push(
      watchFileDebounced(newPath, () => {
        if (!win.isDestroyed()) win.webContents.send('sketch-changed');
      }),
    );
    args.sketchPath = newPath;
  };

  ipcMain.on('set-watch-sketch', onSetWatchSketch);

  const onSaveSketchPreview = async (
    _e,
    { galleryDir: dir, sketchPath, dataURL },
  ) => {
    const previewDir = path.join(dir, '.mp5-previews');
    await fs.promises.mkdir(previewDir, { recursive: true });
    const base =
      args.galleryNames?.[sketchPath] ?? path.basename(sketchPath, '.js');
    const data = dataURL.replace(/^data:image\/jpeg;base64,/, '');
    await fs.promises.writeFile(
      path.join(previewDir, `${base}.jpg`),
      data,
      'base64',
    );
  };

  ipcMain.handle('save-sketch-preview', onSaveSketchPreview);

  const onOpenGalleryDir = () => shell.openPath(galleryDir ?? args.galleryDir);

  ipcMain.on('open-gallery-dir', onOpenGalleryDir);

  const onGalleryStatePush = (_e, obj) => {
    galleryWin?.webContents.send('gallery-state-push', obj);
  };

  ipcMain.on('gallery-state-push', onGalleryStatePush);

  const onGallerySettingsUpdate = (_e, obj) => {
    win.webContents.send('gallery-settings-update', obj);
  };

  ipcMain.on('gallery-settings-update', onGallerySettingsUpdate);

  win.on('closed', () => {
    ipcMain.off('toggle-fullscreen', onToggleFullscreen);
    ipcMain.off('resize-window', onResizeWindow);
    ipcMain.off('open-gallery', onOpenGallery);
    ipcMain.removeHandler('open-audio-picker');
    ipcMain.removeHandler('open-sketch-picker');
    ipcMain.off('open-sketch-in-editor', onOpenSketchInEditor);
    ipcMain.off('open-settings', onOpenSettings);
    ipcMain.removeHandler('trigger-render');
    ipcMain.off('set-watch-sketch', onSetWatchSketch);
    ipcMain.removeHandler('save-sketch-preview');
    ipcMain.off('open-gallery-dir', onOpenGalleryDir);
    ipcMain.off('gallery-state-push', onGalleryStatePush);
    ipcMain.off('gallery-settings-update', onGallerySettingsUpdate);
    watchers.forEach((w) => w.close());
    audioWatcher?.close();
  });

  // reload shortcut
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.code === 'KeyR' && input.control) {
      if (!win.isDestroyed()) win.webContents.reload();
    }
  });

  // load visualizer
  win.loadFile(path.join(__dirname, 'visualizer.html'), {
    query: { args: JSON.stringify(args) },
  });
}
