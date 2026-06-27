import { BrowserWindow, ipcMain, dialog, shell, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';
import { resolveBinary } from '../../binaries.js';
import { toNested } from '../../components/engine/preset.js';
import { readConfig, writeConfig } from '../../components/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hasBinary(name) {
  return (
    spawnSync(resolveBinary(name), ['--version'], { stdio: 'ignore' }).error
      ?.code !== 'ENOENT'
  );
}

export function openSettingsWindow(
  defs,
  visWin,
  getAudioBase = null,
  configPath = null,
) {
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
  let sketchDir = defs.sketchDir ?? null;
  let lastPresetDir = null;
  const geometryLocked = defs.initialRendering?.width != null;

  const onDefsPush = (_e, d) => {
    if (d.sketchName) sketchName = d.sketchName;
    if (d.sketchDir) sketchDir = d.sketchDir;
    const toSend = geometryLocked ? { ...d, canvasHint: null } : d;
    const withAudio = getAudioBase
      ? { ...toSend, audioBase: getAudioBase() }
      : toSend;
    if (!win.isDestroyed())
      win.webContents.send('settings-defs-push', withAudio);
  };

  const onParamsUpdate = (_e, obj) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('settings-update', obj);
  };

  // keep the visualizer's rendering state in sync with edits made here so it
  // survives the settings window being closed and reopened
  const onRenderingChanged = (_e, r) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('rendering-update', r);
  };

  // app-level GUI prefs (theme/bg) are session-only; just relay them to the
  // visualizer so it can apply them live
  const onAppPrefs = (_e, p) => {
    if (!visWin.isDestroyed()) visWin.webContents.send('app-prefs-update', p);
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
    const baseDir = lastPresetDir ?? sketchDir ?? process.cwd();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(baseDir, filename),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    lastPresetDir = path.dirname(filePath);
    const payload = {
      version: app.getVersion(),
      params: toNested(values.params),
      rendering: values.rendering,
    };
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2));
    return true;
  };

  // hand the chosen file to the visualizer, which parses and applies it through
  // the same path as a drag-and-dropped preset (it pushes values back here)
  const onLoad = async () => {
    const baseDir = lastPresetDir ?? sketchDir ?? process.cwd();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      defaultPath: baseDir,
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths.length) return;
    lastPresetDir = path.dirname(filePaths[0]);
    if (!visWin.isDestroyed())
      visWin.webContents.send('apply-preset-path', filePaths[0]);
  };

  // the gui group can load a different config file at runtime; track which one
  // is active so saves go back to the same file
  let activeConfigPath = configPath;

  // persist the GUI prefs + current rendering values to the loaded config file;
  // live theme/bg already applied via app-prefs-changed, this just makes them
  // survive restart
  const onConfigSave = async (_e, payload) => {
    if (!activeConfigPath) return false;
    writeConfig(activeConfigPath, { version: app.getVersion(), ...payload });
    return true;
  };

  // load a config chosen in the gui, make it the active save target, and return
  // it so the renderer can apply its values immediately
  const onConfigLoad = (_e, filePath) => {
    if (filePath) activeConfigPath = filePath;
    return readConfig(activeConfigPath);
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
  ipcMain.on('app-prefs-changed', onAppPrefs);
  ipcMain.handle('settings-request-file', onRequestFile);
  ipcMain.handle('settings-save', onSave);
  ipcMain.handle('settings-load', onLoad);
  ipcMain.handle('settings-open-file', onOpenFile);
  ipcMain.handle('settings-browse-output', onBrowseOutput);
  ipcMain.handle('config-save', onConfigSave);
  ipcMain.handle('config-load', onConfigLoad);

  win.on('closed', () => {
    ipcMain.off('settings-defs-push', onDefsPush);
    ipcMain.off('settings-update', onParamsUpdate);
    ipcMain.off('settings-rendering-changed', onRenderingChanged);
    ipcMain.off('app-prefs-changed', onAppPrefs);
    ipcMain.removeHandler('settings-request-file');
    ipcMain.removeHandler('settings-save');
    ipcMain.removeHandler('settings-load');
    ipcMain.removeHandler('settings-open-file');
    ipcMain.removeHandler('settings-browse-output');
    ipcMain.removeHandler('config-save');
    ipcMain.removeHandler('config-load');
  });

  win.loadFile(path.join(__dirname, 'settings.html'), {
    query: { defs: JSON.stringify(defs) },
  });

  return win;
}
