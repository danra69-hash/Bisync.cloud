Bisync.cloud — Desktop app
==========================

Native desktop window for Bisync.cloud (Windows / macOS / Linux).

Source & build
--------------
Repository folder: desktop/

  cd desktop
  npm install
  npm start              # open cloud app
  npm run dev            # open local Vite (http://localhost:5173)
  npm run dist:win       # Windows installer + portable
  npm run dist:mac       # macOS DMG
  npm run dist:linux     # AppImage + deb

Default URL
-----------
https://bisync-cloud-389272498937.asia-southeast1.run.app

Override with environment variable BISYNC_DESKTOP_URL when launching.

Installers (after build)
------------------------
Built files appear in desktop/release/:

  Windows: Bisync.cloud-Setup-*.exe  (and portable)
  macOS:   Bisync.cloud-*-*.dmg
  Linux:   Bisync.cloud-*.AppImage / *.deb

Copy release artifacts into this downloads folder when publishing a new build
for operators.
