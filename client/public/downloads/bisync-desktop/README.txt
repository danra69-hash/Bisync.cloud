Bisync.cloud — Desktop app downloads
====================================

Public downloads (also linked from the Home page):

  Bisync.cloud-Desktop-Windows.exe   — Windows portable Electron app
  Bisync.cloud-Desktop-Linux.AppImage — Linux Electron AppImage
  mac/Bisync.cloud.command           — macOS desktop window launcher
                                      (native macOS .dmg: build with
                                       `cd desktop && npm run dist:mac`)

URLs on the live site:

  /downloads/bisync-desktop/Bisync.cloud-Desktop-Windows.exe
  /downloads/bisync-desktop/Bisync.cloud-Desktop-Linux.AppImage
  /downloads/bisync-desktop/mac/Bisync.cloud.command

Rebuild & publish into this folder:

  cd desktop
  npm install
  npm run dist:win
  npm run dist:linux
  # then copy release artifacts here (see scripts/publish-desktop-downloads.mjs)
