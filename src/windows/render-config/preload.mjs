import { contextBridge, ipcRenderer } from 'electron';

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld('args', {
  sketch: params.get('sketch'),
  audio: params.get('audio'),
  defaultWidth: Number(params.get('width')),
  defaultHeight: Number(params.get('height')),
});

contextBridge.exposeInMainWorld('api', {
  browse: (currentPath) =>
    ipcRenderer.invoke('render-config-browse', currentPath),
  confirm: (config) => ipcRenderer.send('render-config-confirm', config),
  cancel: () => ipcRenderer.send('render-config-cancel'),
});
