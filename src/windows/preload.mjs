import { contextBridge, ipcRenderer, clipboard, webUtils } from 'electron';

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
  openSettings: args.openSettings ?? false,
  initialRendering: args.initialRendering ?? null,
  appPrefs: args.appPrefs ?? null,
  configPath: args.configPath ?? null,
});

contextBridge.exposeInMainWorld('api', {
  writeClipboard: (text) => clipboard.writeText(text),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  openAudioPicker: () => ipcRenderer.invoke('open-audio-picker'),
  switchToMic: () => ipcRenderer.send('switch-to-mic'),
  openSketchPicker: () => ipcRenderer.invoke('open-sketch-picker'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openSketchInEditor: (filePath) =>
    ipcRenderer.send('open-sketch-in-editor', filePath),
  notifyReady: (dims) => ipcRenderer.send('renderer-ready', dims),
  sendFrame: (buffer) => ipcRenderer.send('renderer-frame', buffer),
  openSettings: (defs) => ipcRenderer.send('open-settings', defs),
  openGallery: () => ipcRenderer.send('open-gallery'),
  pushSettingsDefs: (defs) => ipcRenderer.send('settings-defs-push', defs),
  setSettingsRendering: (r) => ipcRenderer.send('settings-set-rendering', r),
  setSettingsParams: (p) => ipcRenderer.send('settings-set-params', p),
  onApplyPresetPath: (cb) => ipcRenderer.on('apply-preset-path', cb),
  onRenderingUpdate: (cb) => ipcRenderer.on('rendering-update', cb),
  onFullscreenChange: (cb) => ipcRenderer.on('fullscreen-changed', cb),
  onSketchChanged: (cb) => ipcRenderer.on('sketch-changed', cb),
  onAudioChanged: (cb) => ipcRenderer.on('audio-changed', cb),
  onRenderPause: (cb) => ipcRenderer.on('render-pause', cb),
  onRenderResume: (cb) => ipcRenderer.on('render-resume', cb),
  onRenderNext: (cb) => ipcRenderer.on('render-next', cb),
  onSettingsUpdate: (cb) => ipcRenderer.on('settings-update', cb),
  onAppPrefsUpdate: (cb) =>
    ipcRenderer.on('app-prefs-update', (_e, p) => cb(p)),
  setWatchSketch: (path) => ipcRenderer.send('set-watch-sketch', path),
  saveSketchPreview: (galleryDir, sketchPath, dataURL) =>
    ipcRenderer.invoke('save-sketch-preview', {
      galleryDir,
      sketchPath,
      dataURL,
    }),
  openGalleryDir: () => ipcRenderer.send('open-gallery-dir'),
  showAudioInFolder: () => ipcRenderer.send('show-audio-in-folder'),
  pushGalleryState: (state) => ipcRenderer.send('gallery-state-push', state),
  onGallerySettingsUpdate: (cb) =>
    ipcRenderer.on('gallery-settings-update', cb),
  onPushGalleryStateRequest: (cb) =>
    ipcRenderer.on('push-gallery-state-request', cb),
  onTriggerOpenSettings: (cb) =>
    ipcRenderer.on('trigger-open-settings', (_e) => cb()),
});
