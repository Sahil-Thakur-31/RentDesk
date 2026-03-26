import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const getStorePath = () => path.join(app.getPath('userData'), 'rentdesk-store.json');
const BACKEND_PORT = Number(process.env.RENTDESK_BACKEND_PORT || 4000);

let backendProcess: ChildProcessWithoutNullStreams | null = null;
let isQuitting = false;

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

const isDevelopment = () => Boolean(process.env.VITE_DEV_SERVER_URL);

const getBundledBackendDir = () => path.join(process.resourcesPath, 'backend');

const waitForBackend = (timeoutMs = 20000) =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const probe = () => {
      const request = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (response) => {
        response.resume();
        if ((response.statusCode || 500) < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.on('error', retry);
      request.setTimeout(2000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Timed out while waiting for the bundled backend.'));
        return;
      }
      setTimeout(probe, 500);
    };

    probe();
  });

const startBundledBackend = async () => {
  if (isDevelopment() || backendProcess) return;

  const backendDir = getBundledBackendDir();
  const backendEntry = path.join(backendDir, 'dist', 'server.js');
  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Bundled backend entry not found: ${backendEntry}`);
  }

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: backendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(BACKEND_PORT)
    },
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[rentdesk-backend] ${chunk}`);
  });

  backendProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[rentdesk-backend] ${chunk}`);
  });

  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (!isQuitting) {
      console.error(`Bundled backend exited with code ${code ?? 'unknown'}`);
    }
  });

  await waitForBackend();
};

const stopBundledBackend = () => {
  if (!backendProcess) return;
  backendProcess.kill();
  backendProcess = null;
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

  const boot = async () => {
    try {
      await startBundledBackend();
    } catch (error) {
      console.error('Failed to start bundled backend', error);
    }

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  };

  void boot();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBundledBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBundledBackend();
    app.quit();
  }
});
