'use strict';

const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const { resolveAppUrl } = require('./config');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const appUrl = resolveAppUrl();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: 'Pulse Admin',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B1220' : '#F7F8FC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void mainWindow.loadURL(appUrl);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Pulse',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
    ]),
  );
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
