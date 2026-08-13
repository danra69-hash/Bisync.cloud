'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bisyncDesktop', {
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke('desktop:get-app-info'),
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
});
