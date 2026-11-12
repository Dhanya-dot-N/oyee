const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mate', {
  ask: (text, personality, language) => ipcRenderer.invoke('ask', { text, personality, language }),
  setSize: (mode) => ipcRenderer.send('set-size', mode),
  stt: (wav, language) => ipcRenderer.invoke('stt', wav, language),
  tts: (text) => ipcRenderer.invoke('tts', text),
  k: {
    get: () => ipcRenderer.invoke('k:get'),
    save: (d) => ipcRenderer.invoke('k:save', d),
  },
  c: {
    list: () => ipcRenderer.invoke('c:list'),
    add: (d) => ipcRenderer.invoke('c:add', d),
    act: (id, action) => ipcRenderer.invoke('c:act', { id, action }),
  },
  onCommitments: (cb) => ipcRenderer.on('commitments', (_e, d) => cb(d)),
  onOpen: (cb) => ipcRenderer.on('open-commitment', (_e, d) => cb(d)),
});
