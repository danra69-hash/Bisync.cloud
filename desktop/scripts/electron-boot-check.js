'use strict';

const { app } = require('electron');

app.whenReady().then(() => {
  // eslint-disable-next-line no-console
  console.log(`electron-boot-ok ${process.versions.electron}`);
  app.quit();
});
