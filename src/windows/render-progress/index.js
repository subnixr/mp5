import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openRenderProgressWindow({
  title,
  sketchPath,
  audioPath,
  output,
  onCancel,
}) {
  const win = new BrowserWindow({
    width: 640,
    height: 180,
    minWidth: 640,
    minHeight: 180,
    resizable: false,
    closable: false,
    title,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.setMenu(null);
  win.setMenuBarVisibility(false);

  if (process.env.MP5_DEBUG) win.webContents.openDevTools();

  relayConsole(win.webContents, 'render-progress');

  const onCancelIpc = () => {
    if (!win.isDestroyed()) win.close();
    onCancel();
  };

  ipcMain.once('cancel-render', onCancelIpc);

  win.on('closed', () => {
    ipcMain.off('cancel-render', onCancelIpc);
  });

  const query = {};
  if (sketchPath) query.sketchPath = sketchPath;
  if (audioPath) query.audioPath = audioPath;
  if (output) query.output = output;

  win.loadFile(path.join(__dirname, 'render-progress.html'), { query });

  return {
    sendProgress: (data) => {
      if (!win.isDestroyed()) win.webContents.send('render-progress', data);
    },
    close: () => {
      if (!win.isDestroyed()) win.close();
    },
  };
}
