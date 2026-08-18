#!/usr/bin/env bash
POS_URL="${POS_URL:-https://bisync-cloud-389272498937.asia-southeast1.run.app/POS?fs=1}"
for bin in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable; do
  if command -v "$bin" >/dev/null 2>&1; then
    exec "$bin" --app="$POS_URL" --start-fullscreen --window-position=0,0 --no-first-run
  fi
done
xdg-open "$POS_URL" >/dev/null 2>&1 || sensible-browser "$POS_URL"
