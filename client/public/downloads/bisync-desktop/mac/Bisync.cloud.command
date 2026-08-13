#!/bin/bash
# Bisync.cloud Desktop — opens the cloud app in a dedicated Chrome/Edge window.
APP_URL="${BISYNC_DESKTOP_URL:-https://bisync-cloud-389272498937.asia-southeast1.run.app}"
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
