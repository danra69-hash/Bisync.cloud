# Bisync101 clips

Silent WebM recordings captured from the **live Bisync.cloud UI**
(cursor moves + typed examples), not synthetic Pillow mockups.

Each clip is **subject-only**: sign-in / company scope / navigation are
performed in a fast setup phase and trimmed out of the final WebM so the
lesson starts on the action being taught (e.g. company + location pickers).

Regenerate:
```bash
BASE_URL=http://127.0.0.1:5173 BISYNC_EMAIL=dra@cubevalue.com BISYNC_PASSWORD='Pass@123' \
  node scripts/capture-bisync101-clips.mjs
```

Optional: `ONLY=gs-sign-in,rms-create-po` to capture a subset.
