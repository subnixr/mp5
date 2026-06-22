import fs from 'fs';
import path from 'path';

// GUI-launched macOS apps inherit a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin)
// that excludes Homebrew dirs, so bare-name spawn() fails to find ffmpeg/ffprobe.
// Resolve to an absolute path by scanning known install locations + PATH.

const EXTRA_DIRS = [
  '/opt/homebrew/bin', // Apple Silicon Homebrew
  '/usr/local/bin', // Intel Homebrew / common unix
  '/usr/bin',
  '/bin',
  '/opt/local/bin', // MacPorts
];

function candidateDirs() {
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);

  return [...new Set([...pathDirs, ...EXTRA_DIRS])];
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolves a binary to an absolute path, honoring an env override
// (e.g. MP5_FFMPEG). Falls back to the bare name so PATH lookup can still
// work when launched from a shell.
export function resolveBinary(name) {
  const override = process.env[`MP5_${name.toUpperCase()}`];
  if (override && isExecutable(override)) return override;

  for (const dir of candidateDirs()) {
    const file = path.join(dir, name);
    if (isExecutable(file)) return file;
  }

  return name;
}
