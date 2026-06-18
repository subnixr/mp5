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
  onReturnToAnimation,
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

  relayConsole(win.webContents, 'progress');

  const onCancelIpc = () => {
    if (!win.isDestroyed()) win.close();
    onCancel();
  };

  const onReturnToAnimationIpc = () => {
    if (!win.isDestroyed()) win.close();
    onReturnToAnimation?.();
  };

  ipcMain.once('cancel-render', onCancelIpc);
  ipcMain.once('return-to-animation', onReturnToAnimationIpc);

  win.on('closed', () => {
    ipcMain.off('cancel-render', onCancelIpc);
    ipcMain.off('return-to-animation', onReturnToAnimationIpc);
  });

  const query = {};
  if (sketchPath) query.sketchPath = sketchPath;
  if (audioPath) query.audioPath = audioPath;
  if (output) query.output = output;

  win.loadFile(path.join(__dirname, 'progress.html'), { query });

  return {
    sendProgress: (data) => {
      if (!win.isDestroyed()) win.webContents.send('progress', data);
    },
    close: () => {
      if (!win.isDestroyed()) win.close();
    },
  };
}
