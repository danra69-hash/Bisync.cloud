# Bisync.cloud Desktop

Electron shell that opens Bisync.cloud in a dedicated desktop window (Windows, macOS, Linux).

Default URL: `https://bisync-cloud-389272498937.asia-southeast1.run.app`

## Prerequisites

- Node.js 20+

## Run (development)

```bash
cd desktop
npm install
npm start
```

Point at local Vite while developing the web client:

```bash
# terminal 1 — client
cd client && npm run dev

# terminal 2 — desktop
cd desktop && npm run dev
```

Override the loaded URL with any host:

```bash
# PowerShell
$env:BISYNC_DESKTOP_URL = "https://bisync-cloud-389272498937.asia-southeast1.run.app"
npm start
```

## Build installers

```bash
cd desktop
npm install
npm run dist:win     # Windows NSIS + portable (build on Windows preferred)
npm run dist:mac     # macOS DMG (build on macOS)
npm run dist:linux   # AppImage + .deb
```

Artifacts land in `desktop/release/`.

Publish installers to the public Home-page download links:

```bash
npm run dist:win
npm run dist:linux
npm run publish:downloads
```

## Download folder

Public files served by the live site (linked from Home):

`client/public/downloads/bisync-desktop/`

- `Bisync.cloud-Desktop-Windows.zip` (launcher — Desktop shortcut + clean login profile)
- `Bisync.cloud-Desktop-macOS.zip`
- Linux desktop packages are not offered
