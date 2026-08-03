#!/bin/bash
POS_URL="${POS_URL:-https://bisync-cloud-389272498937.asia-southeast1.run.app/POS?fs=1}"
open_app() {
  local app="$1"
  open -na "$app" --args --app="$POS_URL" --start-fullscreen
}

if [ -d "/Applications/Google Chrome.app" ]; then
  open_app "Google Chrome"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open_app "Microsoft Edge"
elif [ -d "/Applications/Chromium.app" ]; then
  open_app "Chromium"
else
  open "$POS_URL"
  osascript -e 'display notification "Opened Bisync POS in your default browser." with title "Bisync POS"'
fi
