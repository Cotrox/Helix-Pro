import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopAPI', {
  readCollection: (collectionName) => ipcRenderer.invoke('db:read-collection', collectionName),
  writeCollection: (collectionName, items) => ipcRenderer.invoke('db:write-collection', collectionName, items)
});