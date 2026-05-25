import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain } from 'electron';
import { createDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const projectName = process.env.PROJECT_NAME || 'Helix Pro';
const devServerUrl = 'http://127.0.0.1:3000';

app.setName(projectName);

let database;

const createMainWindow = async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    resizable: true,
    title: projectName,
    backgroundColor: '#0F172A',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (app.isPackaged) {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
};

app.whenReady().then(() => {
  database = createDatabase(projectName);

  ipcMain.handle('db:read-collection', (_event, collectionName) => database.readCollection(collectionName));
  ipcMain.handle('db:write-collection', (_event, collectionName, items) => database.writeCollection(collectionName, items));

  createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (database) {
    database.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});