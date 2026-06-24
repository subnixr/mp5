import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';
import { resolveBinary } from '../../binaries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hasBinary(name) {
  return (
    spawnSync(resolveBinary(name), ['--version'], { stdio: 'ignore' }).error
      ?.code !== 'ENOENT'
  );
}

export function openSettingsWindow(defs, visWin) {
  const win = new BrowserWindow({
    width: 840,
    minWidth: 360,
    resizable: true,
    title: 'mp5 - settings',
    ...(process.platform !== 'darwin' && { parent: visWin }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.setMenu(null);
  win.setMenuBarVisibility(false);

  if (process.env.MP5_DEBUG) win.webContents.openDevTools();

  relayConsole(win.webContents, 'settings');

  let sketchName = defs.sketchName ?? null;
  const geometryLocked = defs.initialRendering?.width != null;

  const onDefsPush = (_e, d) => {
    if (d.sketchName) sketchName = d.sketchName;
    const toSend = geometryLocked ? { ...d, canvasHint: null } : d;
    if (!win.isDestroyed()) win.webContents.send('settings-defs-push', toSend);
  };

  const onParamsUpdate = (_e, obj) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('settings-update', obj);
  };

  // keep the visualizer's rendering state in sync with edits made here so it
  // survives the settings window being closed and reopened
  const onRenderingChanged = (_e, r) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('rendering-update', r);
  };

  const onRequestFile = async (_e, key) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0)
      return { key, path: null };
    return { key, path: result.filePaths[0] };
  };

  const onSave = async (_e, values) => {
    const filename = sketchName ? `${sketchName}.json` : 'params.json';
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(process.cwd(), filename),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    await fs.promises.writeFile(filePath, JSON.stringify(values, null, 2));
    return true;
  };

  // hand the chosen file to the visualizer, which parses and applies it through
  // the same path as a drag-and-dropped preset (it pushes values back here)
  const onLoad = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      defaultPath: process.cwd(),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths.length) return;
    if (!visWin.isDestroyed())
      visWin.webContents.send('apply-preset-path', filePaths[0]);
  };

  const onOpenFile = (_e, filePath) => shell.openPath(filePath);

  const onBrowseOutput = async (_e, defaultName) => {
    const missing = ['ffmpeg', 'ffprobe'].filter((b) => !hasBinary(b));
    if (missing.length) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Missing dependency',
        message: `${missing.join(' and ')} not found in PATH.\nInstall ffmpeg to use render.`,
      });
      return null;
    }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(process.cwd(), defaultName),
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm'] }],
    });
    return canceled ? null : filePath;
  };

  ipcMain.on('settings-defs-push', onDefsPush);
  ipcMain.on('settings-update', onParamsUpdate);
  ipcMain.on('settings-rendering-changed', onRenderingChanged);
  ipcMain.handle('settings-request-file', onRequestFile);
  ipcMain.handle('settings-save', onSave);
  ipcMain.handle('settings-load', onLoad);
  ipcMain.handle('settings-open-file', onOpenFile);
  ipcMain.handle('settings-browse-output', onBrowseOutput);

  win.on('closed', () => {
    ipcMain.off('settings-defs-push', onDefsPush);
    ipcMain.off('settings-update', onParamsUpdate);
    ipcMain.off('settings-rendering-changed', onRenderingChanged);
    ipcMain.removeHandler('settings-request-file');
    ipcMain.removeHandler('settings-save');
    ipcMain.removeHandler('settings-load');
    ipcMain.removeHandler('settings-open-file');
    ipcMain.removeHandler('settings-browse-output');
  });

  win.loadFile(path.join(__dirname, 'settings.html'), {
    query: { defs: JSON.stringify(defs) },
  });

  return win;
}
