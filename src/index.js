import { app, session, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';

import { showHelp, parseArgs } from './cli.js';
import { runVisualizer } from './windows/visualizer/index.js';
import { runRender } from './windows/renderer/index.js';
import { ensureConfig } from './components/config.js';

function resolveZipSketch(zipPath, tmpDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tmpDir, true);
  const entry = path.join(tmpDir, 'sketch.js');
  return fs.existsSync(entry) ? entry : null;
}

// pre-scan argv for -c so the config can be loaded before parseArgs (its render
// defaults feed parseArgs). default lives in the platform config dir, e.g.
// ~/.config/mp5.json on linux.
function resolveConfigPath(argv) {
  const i = argv.indexOf('-c');
  if (i !== -1 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return path.join(app.getPath('appData'), 'mp5.json');
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  const allowed = new Set(['media', 'microphone', 'fullscreen']);
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    allowed.has(permission),
  );
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => callback(allowed.has(permission)),
  );

  try {
    const argv = process.argv.slice(app.isPackaged ? 1 : 2);
    const configPath = resolveConfigPath(argv);
    const config = ensureConfig(configPath);
    const args = parseArgs(argv, config);
    if (args.help) {
      showHelp();
      app.quit();
      return;
    }
    args.configPath = configPath;
    args.appPrefs = config.gui;

    ipcMain.on('app-prefs-changed', (_e, p) => {
      Object.assign(args.appPrefs, p);
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('app-prefs-update', p);
      });
    });

    if (args.sketchPath?.endsWith('.zip')) {
      const zipName = path.basename(args.sketchPath, '.zip');
      const tmpDir = path.join(os.tmpdir(), `mp5-${process.pid}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      app.on('before-quit', () =>
        fs.rmSync(tmpDir, { recursive: true, force: true }),
      );
      const entry = resolveZipSketch(args.sketchPath, tmpDir);
      if (!entry)
        throw new Error(`sketch.js not found in zip: ${args.sketchPath}`);
      args.sketchSourcePath = args.sketchPath;
      args.sketchPath = entry;
      args.sketchDisplayName = zipName;
    }

    if (args.mode === 'render') {
      await runRender(args);
    } else {
      await runVisualizer(args);
    }
  } catch (err) {
    showHelp();
    console.error(err);
    process.exitCode = 1;
    app.quit();
    return;
  }
});

app.on('window-all-closed', () => app.quit());
