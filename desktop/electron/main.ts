import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

const getStorePath = () => path.join(app.getPath('userData'), 'rentdesk-store.json');

const readStore = () => {
  const filePath = getStorePath();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}), 'utf8');
    return {} as Record<string, string>;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

const writeStore = (store: Record<string, string>) => {
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf8');
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(() => {
  ipcMain.on('rentdesk-storage:get', (event, key: string) => {
    event.returnValue = readStore()[key] ?? null;
  });

  ipcMain.on('rentdesk-storage:set', (event, key: string, value: string) => {
    const store = readStore();
    store[key] = value;
    writeStore(store);
    event.returnValue = true;
  });

  ipcMain.on('rentdesk-storage:remove', (event, key: string) => {
    const store = readStore();
    delete store[key];
    writeStore(store);
    event.returnValue = true;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
