import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { relayConsole } from '../error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openGalleryWindow(visWin, theme) {
  const win = new BrowserWindow({
    width: 640,
    minWidth: 400,
    resizable: true,
    title: 'mp5 - gallery',
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

  relayConsole(win.webContents, 'gallery');

  win.loadFile(path.join(__dirname, 'gallery.html'), theme ? { query: { theme } } : undefined);

  return win;
}
