const CONSOLE_METHODS = { 0: 'debug', 1: 'log', 2: 'warn', 3: 'error' };

function formatSource(sourceId, line, full) {
  if (!sourceId) return '';
  const file = full ? sourceId : sourceId.split('/').pop();
  return ` (${file}:${line})`;
}

function formatMessage(message) {
  const lines = message.split('\n');
  if (lines.length === 1) return ` ${message}`;
  return `\n  ${lines.join('\n  ')}`;
}

export function relayConsole(webContents, label) {
  webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const method = CONSOLE_METHODS[level] ?? 'log';
    const src = formatSource(sourceId, line, level >= 2);
    console[method](`[${label}]${src}${formatMessage(message)}`);
  });
}

export function handleErrors(onError) {
  window.addEventListener('error', (e) => {
    const detail = e.error?.stack ?? e.error ?? e.message ?? 'unknown error';
    const location = `${e.filename}:${e.lineno}:${e.colno}`;
    console.error('[error]', location, '\n', detail);
    onError?.(
      `${e.message || 'Error'} — ${e.filename?.split('/').pop()}:${e.lineno}`,
    );
  });
  window.addEventListener('unhandledrejection', (e) => {
    const detail =
      e.reason?.stack ?? e.reason?.message ?? e.reason ?? 'unhandled rejection';
    console.error('[unhandledrejection]', detail);
    onError?.(e.reason?.message ?? String(e.reason) ?? 'Unhandled rejection');
  });
}
