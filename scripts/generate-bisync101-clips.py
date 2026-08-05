#!/usr/bin/env python3
"""Generate short silent WebM screen-lesson clips for every Bisync101 task.

Reads task metadata from the TypeScript module files (clipFile + title + steps)
and writes VP9 WebM files under client/public/bisync101/clips/.

Usage:
  python3 scripts/generate-bisync101-clips.py
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MODULES_DIR = ROOT / "client/src/data/bisync101/modules"
OUT_DIR = ROOT / "client/public/bisync101/clips"
W, H = 960, 540
FPS = 12
STEP_SECONDS = 2.2
INTRO_SECONDS = 0.6


def parse_tasks(ts_path: Path) -> list[dict]:
    text = ts_path.read_text(encoding="utf-8")
    tasks: list[dict] = []
    # Split on task object starts that include id + title + clipFile nearby
    blocks = re.split(r"\n\s*\{\s*\n\s*id:", text)
    for block in blocks[1:]:
        id_m = re.match(r"\s*'([^']+)'", block)
        title_m = re.search(r"title:\s*'((?:\\'|[^'])*)'", block)
        summary_m = re.search(r"summary:\s*'((?:\\'|[^'])*)'", block)
        clip_m = re.search(r"clipFile:\s*'([^']+)'", block)
        if not (id_m and title_m and clip_m):
            continue
        step_titles = re.findall(r"title:\s*'((?:\\'|[^'])*)'", block)
        # first title is task title; remaining are step titles (plus maybe hotspot labels skipped if no 'title' in hotspot)
        # Actually hotspot has label: not title. step titles after task title.
        steps = step_titles[1:] if len(step_titles) > 1 else [title_m.group(1)]
        tasks.append(
            {
                "id": id_m.group(1),
                "title": title_m.group(1).replace("\\'", "'"),
                "summary": (summary_m.group(1).replace("\\'", "'") if summary_m else ""),
                "clipFile": clip_m.group(1),
                "steps": [s.replace("\\'", "'") for s in steps],
            }
        )
    return tasks


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def draw_frame(task: dict, step_index: int, t: float) -> Image.Image:
    img = Image.new("RGB", (W, H), "#2A2118")
    d = ImageDraw.Draw(img)
    bold = font(22)
    mid = font(16)
    small = font(13)
    tiny = font(11)

    # Top bar
    d.rectangle([0, 0, W, int(H * 0.1)], fill="#241c15")
    d.rounded_rectangle([24, 14, 120, 38], radius=4, fill="#F37021")
    d.text((136, 18), "Bisync.cloud", fill="white", font=mid)

    # Sidebar
    d.rectangle([0, int(H * 0.1), int(W * 0.2), H], fill="#1c1612")
    for i in range(6):
        y = int(H * (0.18 + i * 0.08))
        d.rectangle([20, y, int(W * 0.17), y + 12], fill="#3a322b")

    # Content
    d.rounded_rectangle([int(W * 0.23), int(H * 0.14), int(W * 0.95), int(H * 0.86)], radius=10, fill="#f7f4ef")
    d.text((int(W * 0.26), int(H * 0.18)), task["title"][:54], fill="#2A2118", font=bold)

    summary = task["summary"][:110]
    d.text((int(W * 0.26), int(H * 0.26)), summary, fill="#5c534a", font=small)

    steps = task["steps"] or [task["title"]]
    step_title = steps[min(step_index, len(steps) - 1)]

    # Highlight box
    hx, hy, hw, hh = int(W * 0.3), int(H * 0.36), int(W * 0.5), int(H * 0.28)
    pulse = 0.15 + 0.1 * abs((t * 4) % 2 - 1)
    base = img.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle(
        [hx, hy, hx + hw, hy + hh],
        outline=(243, 112, 33, 255),
        width=3,
        fill=(243, 112, 33, int(40 + pulse * 80)),
    )
    img = Image.alpha_composite(base, overlay).convert("RGB")
    d = ImageDraw.Draw(img)

    # Cursor
    cx = hx + int(hw * (0.3 + 0.4 * ((t * 1.7) % 1)))
    cy = hy + int(hh * 0.55)
    d.polygon(
        [
            (cx, cy),
            (cx, cy + 18),
            (cx + 5, cy + 14),
            (cx + 10, cy + 22),
            (cx + 13, cy + 20),
            (cx + 8, cy + 12),
            (cx + 14, cy + 12),
        ],
        fill="white",
        outline="#111",
    )

    # Caption
    d.rectangle([0, int(H * 0.88), W, H], fill="#111111")
    d.text((24, int(H * 0.905)), f"STEP {step_index + 1}", fill="#F37021", font=tiny)
    d.text((110, int(H * 0.9)), step_title[:70], fill="white", font=mid)
    d.text((24, 8), "Bisync101 · screen capture", fill="#dddddd", font=tiny)
    return img


def render_clip(task: dict, out_path: Path) -> None:
    steps = task["steps"] or [task["title"]]
    frames_dir = Path(tempfile.mkdtemp(prefix="bisync101-"))
    try:
        frame_i = 0
        # intro
        intro_frames = max(1, int(INTRO_SECONDS * FPS))
        for i in range(intro_frames):
            draw_frame(task, 0, i / FPS).save(frames_dir / f"f{frame_i:05d}.png")
            frame_i += 1
        for step_index in range(len(steps)):
            n = max(1, int(STEP_SECONDS * FPS))
            for i in range(n):
                draw_frame(task, step_index, i / FPS).save(frames_dir / f"f{frame_i:05d}.png")
                frame_i += 1

        out_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(frames_dir / "f%05d.png"),
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "450k",
            "-an",
            "-pix_fmt",
            "yuv420p",
            str(out_path),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required")
    tasks: list[dict] = []
    for path in sorted(MODULES_DIR.glob("*.ts")):
        tasks.extend(parse_tasks(path))
    if not tasks:
        raise SystemExit(f"No tasks found under {MODULES_DIR}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Generating {len(tasks)} clips → {OUT_DIR}")
    for task in tasks:
        out = OUT_DIR / task["clipFile"]
        print(f"  {task['clipFile']} — {task['title']}")
        render_clip(task, out)
    readme = OUT_DIR / "README.md"
    readme.write_text(
        "# Bisync101 clips\n\n"
        "Short silent WebM captures, one per task (`{taskId}.webm`).\n"
        "Regenerate with `python3 scripts/generate-bisync101-clips.py`.\n"
        "Replace any file with a real screen recording of the same name to upgrade fidelity.\n",
        encoding="utf-8",
    )
    print("Done.")


if __name__ == "__main__":
    main()
