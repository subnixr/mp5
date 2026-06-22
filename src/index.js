import { app, session } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';

import { showHelp, parseArgs } from './cli.js';
import { runVisualizer } from './windows/visualizer/index.js';
import { runRender } from './windows/renderer/index.js';

function resolveZipSketch(zipPath, tmpDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tmpDir, true);
  const entry = path.join(tmpDir, 'sketch.js');
  return fs.existsSync(entry) ? entry : null;
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
    const args = parseArgs(process.argv.slice(app.isPackaged ? 1 : 2));
    if (args.help) {
      showHelp();
      app.quit();
      return;
    }

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
