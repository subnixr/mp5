import { contextBridge, ipcRenderer, clipboard } from 'electron';

const args = JSON.parse(new URLSearchParams(location.search).get('args'));

contextBridge.exposeInMainWorld('args', {
  sketchPath: args.sketchPath,
  audioPath: args.audioPath,
  mode: args.mode,
  startTime: args.startTime,
  length: args.length,
  frameRate: args.frameRate,
  width: args.width,
  height: args.height,
  initialParams: args.initialParams,
  galleryDir: args.galleryDir ?? null,
  galleryPaths: args.galleryPaths ?? null,
  galleryNames: args.galleryNames ?? null,
  sketchDisplayName: args.sketchDisplayName ?? null,
});

contextBridge.exposeInMainWorld('api', {
  writeClipboard: (text) => clipboard.writeText(text),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  openAudioPicker: () => ipcRenderer.invoke('open-audio-picker'),
  openSketchPicker: () => ipcRenderer.invoke('open-sketch-picker'),
  openSketchInEditor: (filePath) =>
    ipcRenderer.send('open-sketch-in-editor', filePath),
  notifyReady: () => ipcRenderer.send('renderer-ready'),
  sendFrame: (buffer) => ipcRenderer.send('renderer-frame', buffer),
  openSettings: (defs) => ipcRenderer.send('open-settings', defs),
  openGallery: () => ipcRenderer.send('open-gallery'),
  pushSettingsDefs: (defs) => ipcRenderer.send('settings-defs-push', defs),
  onFullscreenChange: (cb) => ipcRenderer.on('fullscreen-changed', cb),
  onSketchChanged: (cb) => ipcRenderer.on('sketch-changed', cb),
  onAudioChanged: (cb) => ipcRenderer.on('audio-changed', cb),
  onRenderPause: (cb) => ipcRenderer.on('render-pause', cb),
  onRenderResume: (cb) => ipcRenderer.on('render-resume', cb),
  onRenderNext: (cb) => ipcRenderer.on('render-next', cb),
  onSettingsUpdate: (cb) => ipcRenderer.on('settings-update', cb),
  setWatchSketch: (path) => ipcRenderer.send('set-watch-sketch', path),
  saveSketchPreview: (galleryDir, sketchPath, dataURL) =>
    ipcRenderer.invoke('save-sketch-preview', {
      galleryDir,
      sketchPath,
      dataURL,
    }),
  openGalleryDir: () => ipcRenderer.send('open-gallery-dir'),
  pushGalleryState: (state) => ipcRenderer.send('gallery-state-push', state),
  onGallerySettingsUpdate: (cb) =>
    ipcRenderer.on('gallery-settings-update', cb),
  onPushGalleryStateRequest: (cb) =>
    ipcRenderer.on('push-gallery-state-request', cb),
});
