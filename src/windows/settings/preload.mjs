import { contextBridge, ipcRenderer } from 'electron';

const definitions = JSON.parse(
  new URLSearchParams(location.search).get('defs'),
);

contextBridge.exposeInMainWorld('api', {
  definitions,
  updateParam: (key, val) =>
    ipcRenderer.send('settings-update', { [key]: val }),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  requestFile: (key) => ipcRenderer.invoke('settings-request-file', key),
  onDefinitionsChanged: (cb) =>
    ipcRenderer.on('settings-defs-push', (_e, defs) => cb(defs)),
  onApplyRendering: (cb) =>
    ipcRenderer.on('settings-apply-rendering', (_e, r) => cb(r)),
  onApplyParams: (cb) =>
    ipcRenderer.on('settings-apply-params', (_e, p) => cb(p)),
  pushRendering: (r) => ipcRenderer.send('settings-rendering-changed', r),
  setAppPrefs: (prefs) => ipcRenderer.send('app-prefs-changed', prefs),
  saveConfig: (cfg) => ipcRenderer.invoke('config-save', cfg),
  loadConfig: (filePath) => ipcRenderer.invoke('config-load', filePath),
  saveParams: (values) => ipcRenderer.invoke('settings-save', values),
  loadParams: () => ipcRenderer.invoke('settings-load'),
  browseOutput: (defaultName) =>
    ipcRenderer.invoke('settings-browse-output', defaultName),
  openFile: (filePath) => ipcRenderer.invoke('settings-open-file', filePath),
  confirmMicRender: () => ipcRenderer.invoke('confirm-mic-render'),
  triggerRender: (payload) => ipcRenderer.invoke('trigger-render', payload),
});
