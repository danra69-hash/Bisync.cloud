'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pulseDesktop', true);
