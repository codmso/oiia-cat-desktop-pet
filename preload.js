const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  onKeystroke: (cb) => ipcRenderer.on('global-keystroke', cb),
  onMutedChange: (cb) => ipcRenderer.on('set-muted', (_e, v) => cb(v)),
  getMuted: () => ipcRenderer.invoke('get-muted'),
});
