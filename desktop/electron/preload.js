const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rentdesk', {
  platform: process.platform,
  storage: {
    getItem: (key) => ipcRenderer.sendSync('rentdesk-storage:get', key),
    setItem: (key, value) => ipcRenderer.sendSync('rentdesk-storage:set', key, value),
    removeItem: (key) => ipcRenderer.sendSync('rentdesk-storage:remove', key)
  }
});
