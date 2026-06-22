import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
    height: 280,
    minWidth: 640,
    minHeight: 280,
    resizable: true,
    closable: false,
    title,
    alwaysOnTop: true,
    ...(process.platform === 'linux' && { type: 'dialog' }),
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

  // win.close() is a no-op because the window is closable: false (blocks the
  // OS close button mid-render); destroy() bypasses that to close it in code.
  // The replacement window must open BEFORE we destroy this one, otherwise
  // window-all-closed fires in between and app.quit() kills the app.
  const onCancelIpc = () => {
    onCancel();
    if (!win.isDestroyed()) win.destroy();
  };

  const onReturnToAnimationIpc = () => {
    onReturnToAnimation?.();
    if (!win.isDestroyed()) win.destroy();
  };

  // destroy first: app.quit() closes windows via close(), which closable: false
  // blocks, so the quit would otherwise stall.
  const onQuitAppIpc = () => {
    if (!win.isDestroyed()) win.destroy();
    app.quit();
  };

  const onOpenOutputFolderIpc = () => {
    if (output) shell.showItemInFolder(output);
  };

  ipcMain.once('cancel-render', onCancelIpc);
  ipcMain.once('return-to-animation', onReturnToAnimationIpc);
  ipcMain.once('quit-app', onQuitAppIpc);
  ipcMain.on('open-output-folder', onOpenOutputFolderIpc);

  win.on('closed', () => {
    ipcMain.off('cancel-render', onCancelIpc);
    ipcMain.off('return-to-animation', onReturnToAnimationIpc);
    ipcMain.off('quit-app', onQuitAppIpc);
    ipcMain.off('open-output-folder', onOpenOutputFolderIpc);
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
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
