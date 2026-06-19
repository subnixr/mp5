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
  saveParams: (values) => ipcRenderer.invoke('settings-save', values),
  loadParams: () => ipcRenderer.invoke('settings-load'),
  browseOutput: (defaultName) =>
    ipcRenderer.invoke('settings-browse-output', defaultName),
  triggerRender: (payload) =>
    ipcRenderer.invoke('trigger-render', payload),
});
