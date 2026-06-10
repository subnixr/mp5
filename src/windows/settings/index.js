import { BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openSettingsWindow(defs, visWin, opts = {}) {
  const win = new BrowserWindow({
    width: opts.galleryMode ? 840 : 420,
    minWidth: opts.galleryMode ? 840 : 420,
    resizable: true,
    title: 'mp5 - settings',
    parent: visWin,
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

  const onDefsPush = (_e, d) => {
    if (d.sketchName) sketchName = d.sketchName;
    if (!win.isDestroyed()) win.webContents.send('settings-defs-push', d);
  };

  const onParamsUpdate = (_e, obj) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('settings-update', obj);
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

  const onLoad = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      defaultPath: process.cwd(),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths.length) return null;
    return JSON.parse(await fs.promises.readFile(filePaths[0], 'utf-8'));
  };

  ipcMain.on('settings-defs-push', onDefsPush);
  ipcMain.on('settings-update', onParamsUpdate);
  ipcMain.handle('settings-request-file', onRequestFile);
  ipcMain.handle('settings-save', onSave);
  ipcMain.handle('settings-load', onLoad);

  win.on('closed', () => {
    ipcMain.off('settings-defs-push', onDefsPush);
    ipcMain.off('settings-update', onParamsUpdate);
    ipcMain.removeHandler('settings-request-file');
    ipcMain.removeHandler('settings-save');
    ipcMain.removeHandler('settings-load');
  });

  win.loadFile(path.join(__dirname, 'settings.html'), {
    query: { defs: JSON.stringify(defs) },
  });

  return win;
}
