import { BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openRenderConfigWindow({
  sketchPath,
  audioPath,
  width,
  height,
  params,
  visWin,
  onConfirm,
  onCancel,
}) {
  const win = new BrowserWindow({
    width: 480,
    height: 400,
    minWidth: 480,
    minHeight: 400,
    resizable: true,
    title: 'mp5 - render',
    parent: visWin,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.setMenu(null);
  win.setMenuBarVisibility(false);

  if (process.env.MP5_DEBUG) win.webContents.openDevTools();

  relayConsole(win.webContents, 'render-config');

  const sketchBase = sketchPath ? path.basename(sketchPath, '.js') : null;
  const audioBase = audioPath
    ? path.basename(audioPath, path.extname(audioPath))
    : null;

  const onBrowse = async (_, currentOutput) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: currentOutput,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    });
    if (canceled || !filePath) return null;
    return filePath;
  };

  const onConfirmIpc = (_e, config) => {
    if (!win.isDestroyed()) win.close();
    onConfirm({ ...config, params });
  };

  const onCancelIpc = () => {
    if (!win.isDestroyed()) win.close();
    onCancel();
  };

  ipcMain.handle('render-config-browse', onBrowse);
  ipcMain.once('render-config-confirm', onConfirmIpc);
  ipcMain.once('render-config-cancel', onCancelIpc);

  win.on('closed', () => {
    ipcMain.removeHandler('render-config-browse');
    ipcMain.off('render-config-confirm', onConfirmIpc);
    ipcMain.off('render-config-cancel', onCancelIpc);
  });

  win.loadFile(path.join(__dirname, 'render-config.html'), {
    query: {
      sketch: sketchBase ?? '',
      audio: audioBase ?? '',
      width: String(width),
      height: String(height),
    },
  });

  return win;
}
