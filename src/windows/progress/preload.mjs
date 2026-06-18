import { contextBridge, ipcRenderer } from 'electron';

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld('args', {
  sketchPath: params.get('sketchPath'),
  audioPath: params.get('audioPath'),
  output: params.get('output'),
});

contextBridge.exposeInMainWorld('api', {
  cancelRender: () => ipcRenderer.send('cancel-render'),
  returnToAnimation: () => ipcRenderer.send('return-to-animation'),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, data) => cb(data)),
});
