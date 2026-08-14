'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme, session } = require('electron');
const path = require('path');
const { resolveAppUrl, DEFAULT_CLOUD_URL } = require('./config');

/** @type {BrowserWindow | null} */
let mainWindow = null;

const isMac = process.platform === 'darwin';

async function clearDesktopHttpCache() {
  try {
    await session.defaultSession.clearCache();
  } catch {
    /* ignore — still load */
  }
}

async function createWindow() {
  const appUrl = resolveAppUrl({ bustCache: true });

  // Closed → reopened desktop windows must not reuse a stale HTTP cache of the SPA.
  await clearDesktopHttpCache();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'Bisync.cloud',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const allowed = new URL(appUrl);
      if (target.origin !== allowed.origin) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  void mainWindow.loadURL(appUrl).catch(async (err) => {
    const detail = err instanceof Error ? err.message : String(err);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Bisync.cloud',
      message: 'Unable to open Bisync.cloud',
      detail: `${detail}\n\nTried: ${appUrl}\n\nCheck your network, or set BISYNC_DESKTOP_URL for a custom host.`,
    });
  });

  buildMenu(appUrl);
}

function buildMenu(appUrl) {
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: async () => {
            await clearDesktopHttpCache();
            mainWindow?.webContents.reloadIgnoringCache();
          },
        },
        { type: 'separator' },
        {
          label: 'Open in Browser',
          click: () => {
            void shell.openExternal(appUrl || DEFAULT_CLOUD_URL);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Bisync.cloud on the web',
          click: () => {
            void shell.openExternal(DEFAULT_CLOUD_URL);
          },
        },
        {
          label: 'About Bisync.cloud Desktop',
          click: async () => {
            await dialog.showMessageBox({
              type: 'info',
              title: 'About Bisync.cloud',
              message: 'Bisync.cloud Desktop',
              detail: `Version ${app.getVersion()}\n\nLoads your Bisync.cloud workspace in a dedicated desktop window.\n\nCurrent URL:\n${resolveAppUrl()}`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('desktop:get-app-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  appUrl: resolveAppUrl(),
}));

ipcMain.handle('desktop:open-external', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Invalid URL' };
  }
  await shell.openExternal(url);
  return { ok: true };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      void createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    void createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
