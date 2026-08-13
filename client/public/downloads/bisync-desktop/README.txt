Bisync.cloud — Desktop app downloads
====================================

Current launcher version: 1.1.0
Manifest: /downloads/bisync-desktop/version.json

Public downloads (linked from the Home page, under Team chat):

  Bisync.cloud-Desktop-Windows.zip
    1. Unzip
    2. Double-click Install-Desktop-Shortcut.vbs  (creates Desktop shortcut with Bisync logo)
       — or run Bisync.cloud.bat (creates the shortcut, then opens the app)
    3. Use the Desktop / Start Menu “Bisync.cloud” shortcut thereafter
    4. After platform updates, Home shows a desktop update notice after login

  Bisync.cloud-Desktop-macOS.zip    — open Bisync.cloud.command
    (right-click → Open the first time)

Linux desktop packages are not offered.

Bump / rebuild:
  DESKTOP_VERSION=1.2.0 node scripts/pack-desktop-launcher-zips.mjs
