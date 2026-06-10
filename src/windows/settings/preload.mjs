import { contextBridge, ipcRenderer } from 'electron';

const definitions = JSON.parse(
  new URLSearchParams(location.search).get('defs'),
);

contextBridge.exposeInMainWorld('api', {
  definitions,
  updateParam: (key, val) =>
    ipcRenderer.send('settings-update', { [key]: val }),
  requestFile: (key) => ipcRenderer.invoke('settings-request-file', key),
  onDefinitionsChanged: (cb) =>
    ipcRenderer.on('settings-defs-push', (_e, defs) => cb(defs)),
  saveParams: (values) => ipcRenderer.invoke('settings-save', values),
  loadParams: () => ipcRenderer.invoke('settings-load'),
  triggerRender: (params) => ipcRenderer.invoke('trigger-render', { params }),
  galleryDefs: {
    dir: definitions.galleryDir ?? null,
    paths: definitions.galleryPaths ?? null,
  },
  updateGallerySettings: (obj) =>
    ipcRenderer.send('gallery-settings-update', obj),
  onGalleryStatePush: (cb) =>
    ipcRenderer.on('gallery-state-push', (_e, state) => cb(state)),
});
