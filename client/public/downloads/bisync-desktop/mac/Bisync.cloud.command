#!/bin/bash
# Bisync.cloud Desktop — opens the cloud app in a dedicated Chrome/Edge window.
# Desktop launcher version — bump via scripts/pack-desktop-launcher-zips.mjs + version.json
DESKTOP_VERSION="1.1.0"
APP_URL="${BISYNC_DESKTOP_URL:-https://bisync-cloud-389272498937.asia-southeast1.run.app/?desktop=1&desktopVersion=${DESKTOP_VERSION}}"
mkdir -p "$HOME/Library/Application Support/Bisync.cloud-Desktop" 2>/dev/null || true
echo "$DESKTOP_VERSION" > "$HOME/Library/Application Support/Bisync.cloud-Desktop/version.txt" 2>/dev/null || true

open_app() {
  local app="$1"
  open -na "$app" --args --app="$APP_URL" --new-window
}

if [ -d "/Applications/Google Chrome.app" ]; then
  open_app "Google Chrome"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open_app "Microsoft Edge"
elif [ -d "/Applications/Chromium.app" ]; then
  open_app "Chromium"
else
  open "$APP_URL"
  osascript -e 'display notification "Opened Bisync.cloud in your default browser." with title "Bisync.cloud"'
fi
