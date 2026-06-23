import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  updateGallerySettings: (obj) =>
    ipcRenderer.send('gallery-settings-update', obj),
  onGalleryStatePush: (cb) =>
    ipcRenderer.on('gallery-state-push', (_e, state) => cb(state)),
});
