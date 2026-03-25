import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rentdesk', {
  platform: process.platform,
  storage: {
    getItem: (key: string) => ipcRenderer.sendSync('rentdesk-storage:get', key),
    setItem: (key: string, value: string) => ipcRenderer.sendSync('rentdesk-storage:set', key, value),
    removeItem: (key: string) => ipcRenderer.sendSync('rentdesk-storage:remove', key)
  }
});
