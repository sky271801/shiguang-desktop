const { contextBridge, ipcRenderer } = require('electron');
const invoke = (name) => (...args) => ipcRenderer.invoke(name, ...args);
contextBridge.exposeInMainWorld('vault', {
  list: invoke('notes:list'), save: invoke('notes:save'), action: invoke('notes:action'),
  clipboard: invoke('clipboard:read'), copy: invoke('clipboard:write'),
  pickImages: invoke('images:pick'), addImage: invoke('images:add'),
  pickFiles: invoke('files:pick'), addFile: invoke('files:add'), openFile: invoke('files:open'), saveFile: invoke('files:save'),
  exportBackup: invoke('backup:export'), importBackup: invoke('backup:import'),
  info: invoke('app:info'), folder: invoke('app:folder'), openLink: invoke('link:open'),
  quit: invoke('app:quit'),
  getStartup: invoke('startup:get'), setStartup: invoke('startup:set'),
  changeStorage: invoke('storage:change'),
  onStorageProgress: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('storage-progress', listener); return () => ipcRenderer.removeListener('storage-progress', listener); },
  onFocusInput: callback => { const listener = () => callback(); ipcRenderer.on('focus-input', listener); return () => ipcRenderer.removeListener('focus-input', listener); },
  onCapture: callback => { const listener = () => callback(); ipcRenderer.on('capture', listener); return () => ipcRenderer.removeListener('capture', listener); }
});
