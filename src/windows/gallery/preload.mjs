import { contextBridge, ipcRenderer } from 'electron';

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld('args', {
  theme: params.get('theme'),
});

contextBridge.exposeInMainWorld('api', {
  updateGallerySettings: (obj) =>
    ipcRenderer.send('gallery-settings-update', obj),
  onGalleryStatePush: (cb) =>
    ipcRenderer.on('gallery-state-push', (_e, state) => cb(state)),
  onAppPrefsUpdate: (cb) =>
    ipcRenderer.on('app-prefs-update', (_e, p) => cb(p)),
});
