#!/usr/bin/env bash
APP_URL="${BISYNC_DESKTOP_URL:-https://bisync-cloud-389272498937.asia-southeast1.run.app}"
for bin in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable; do
  if command -v "$bin" >/dev/null 2>&1; then
    exec "$bin" --app="$APP_URL" --new-window --no-first-run
  fi
done
xdg-open "$APP_URL" >/dev/null 2>&1 || sensible-browser "$APP_URL"
