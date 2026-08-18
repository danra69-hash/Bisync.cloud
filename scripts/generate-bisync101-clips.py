#!/usr/bin/env python3
"""DEPRECATED generator — draws synthetic Pillow “platform-looking” frames.

Prefer live UI captures with cursor motion + typing:

  BASE_URL=http://127.0.0.1:5173 \\
  BISYNC_EMAIL=dra@cubevalue.com BISYNC_PASSWORD='Pass@123' \\
  node scripts/capture-bisync101-clips.mjs

This script remains only as an emergency offline fallback.
"""

from __future__ import annotations

import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MODULES_DIR = ROOT / "client/src/data/bisync101/modules"
OUT_DIR = ROOT / "client/public/bisync101/clips"
LOGO_PATH = ROOT / "client/public/bisync-logo.png"
W, H = 960, 540
FPS = 12
STEP_SECONDS = 2.2
INTRO_SECONDS = 0.6

SADDLE = (42, 33, 24)
SADDLE_DEEP = (36, 28, 21)
ORANGE = (243, 112, 33)
WHITE = (255, 255, 255)
MUTED = (107, 94, 82)
BORDER = (42, 33, 24, 30)
CARD = (255, 255, 255)
BG = (255, 255, 255)
SOFT = (245, 242, 238)

MODULE_TILES = [
    ("RMS", "Revenue Management", (243, 112, 33)),
    ("POS", "Point-of-Sales", (42, 122, 106)),
    ("HRM", "Human Resources", (59, 110, 165)),
    ("Accounting", "Accounting", (138, 106, 42)),
]

NAV_ITEMS = [
    "Home",
    "Revenue Management",
    "Point-of-Sales",
    "Human Resources",
    "Accounting",
    "System Configuration",
]


def parse_tasks(ts_path: Path) -> list[dict]:
    text = ts_path.read_text(encoding="utf-8")
    tasks: list[dict] = []
    blocks = re.split(r"\n\s*\{\s*\n\s*id:", text)
    for block in blocks[1:]:
        id_m = re.match(r"\s*'([^']+)'", block)
        title_m = re.search(r"title:\s*'((?:\\'|[^'])*)'", block)
        summary_m = re.search(r"summary:\s*'((?:\\'|[^'])*)'", block)
        where_m = re.search(r"whereInApp:\s*'((?:\\'|[^'])*)'", block)
        clip_m = re.search(r"clipFile:\s*'([^']+)'", block)
        if not (id_m and title_m and clip_m):
            continue
        step_titles = re.findall(r"title:\s*'((?:\\'|[^'])*)'", block)
        steps = step_titles[1:] if len(step_titles) > 1 else [title_m.group(1)]
        hotspots = []
        for hm in re.finditer(
            r"hotspot:\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)(?:,\s*label:\s*'((?:\\'|[^'])*)')?\s*\}",
            block,
        ):
            hotspots.append(
                {
                    "x": float(hm.group(1)),
                    "y": float(hm.group(2)),
                    "w": float(hm.group(3)),
                    "h": float(hm.group(4)),
                    "label": (hm.group(5) or "").replace("\\'", "'"),
                }
            )
        tasks.append(
            {
                "id": id_m.group(1),
                "title": title_m.group(1).replace("\\'", "'"),
                "summary": (summary_m.group(1).replace("\\'", "'") if summary_m else ""),
                "whereInApp": (where_m.group(1).replace("\\'", "'") if where_m else ""),
                "clipFile": clip_m.group(1),
                "steps": [s.replace("\\'", "'") for s in steps],
                "hotspots": hotspots,
            }
        )
    return tasks


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = (
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        ),
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def screen_kind(task_id: str) -> str:
    if task_id == "gs-sign-in":
        return "login"
    if task_id == "gs-navigate-modules":
        return "home-sidebar"
    if task_id == "gs-bisync101":
        return "home-101"
    if task_id.startswith("gs-"):
        return "home"
    if task_id.startswith("sc-"):
        return "system"
    if task_id.startswith("rms-"):
        return "rms"
    if task_id == "pos-take-order":
        return "pos-floor"
    if task_id.startswith("pos-"):
        return "pos"
    if task_id.startswith("hr-"):
        return "hr"
    if task_id.startswith("ac-"):
        return "accounting"
    return "home"


def page_title(task: dict) -> str:
    kind = screen_kind(task["id"])
    if kind == "login" or kind.startswith("home"):
        return "Home"
    where = task.get("whereInApp") or ""
    if "→" in where:
        return where.split("→")[-1].strip()[:28]
    if "·" in where:
        return where.split("·")[-1].strip()[:28]
    if where:
        return where.strip()[:28]
    return task["title"][:28]


def rounded_rect(d: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width: int = 1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_brand_lockup(d: ImageDraw.ImageDraw, x: int, y: int) -> None:
    bold = font(13, True)
    d.text((x, y), "Bisync.", fill=WHITE, font=bold)
    tw = d.textlength("Bisync.", font=bold)
    d.text((x + tw, y), "cloud", fill=ORANGE, font=bold)
    ax = x + tw + d.textlength("cloud", font=bold) + 6
    d.line([(ax, y + 7), (ax + 16, y + 7)], fill=(255, 255, 255, 140), width=2)
    d.polygon([(ax + 12, y + 3), (ax + 18, y + 7), (ax + 12, y + 11)], fill=ORANGE)
    d.text((ax + 22, y), "pasar", fill=WHITE, font=bold)
    pw = d.textlength("pasar", font=bold)
    d.text((ax + 22 + pw, y), ".ai", fill=ORANGE, font=bold)


def draw_header(d: ImageDraw.ImageDraw, title: str, *, show_101: bool = True) -> None:
    header_h = int(H * 0.11)
    d.rectangle([0, 0, W, header_h], fill=SADDLE)
    d.line([(0, header_h - 1), (W, header_h - 1)], fill=(255, 255, 255, 20), width=1)
    # Menu
    d.rectangle([14, 16, 34, 36], outline=(255, 255, 255, 180), width=1)
    for i in range(3):
        yy = 20 + i * 5
        d.line([(18, yy), (30, yy)], fill=WHITE, width=2)
    draw_brand_lockup(d, 44, 18)
    # Divider + page title (keep short so company/location chips stay readable)
    d.line([(210, 14), (210, 40)], fill=(255, 255, 255, 40), width=1)
    d.text((220, 14), title[:18], fill=WHITE, font=font(13, True))
    d.text((220, 32), "Asia/Singapore · 12:00", fill=(255, 255, 255, 140), font=font(9))
    # Company / location chips
    rounded_rect(d, [430, 14, 560, 40], 6, (255, 255, 255, 18), outline=(255, 255, 255, 40))
    d.text((440, 20), "Company ▾", fill=WHITE, font=font(11))
    rounded_rect(d, [570, 14, 690, 40], 6, (255, 255, 255, 18), outline=(255, 255, 255, 40))
    d.text((580, 20), "Location ▾", fill=WHITE, font=font(11))
    # Right actions
    rx = W - 18
    if show_101:
        rounded_rect(d, [rx - 88, 14, rx, 40], 6, ORANGE)
        d.text((rx - 78, 20), "Bisync101", fill=WHITE, font=font(10, True))
        rx -= 98
    # Language flag circle
    d.ellipse([rx - 26, 14, rx, 40], fill=(255, 255, 255, 25), outline=(255, 255, 255, 50))
    d.text((rx - 20, 20), "EN", fill=WHITE, font=font(10, True))
    rx -= 36
    d.ellipse([rx - 22, 16, rx, 38], outline=(255, 255, 255, 120), width=1)
    d.text((rx - 16, 20), "⌂", fill=ORANGE, font=font(12))


def draw_sidebar(base: Image.Image, active: str = "Home") -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 90))
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    panel_w = int(W * 0.28)
    d.rectangle([0, 0, panel_w, H], fill=(*SADDLE, 255))
    d.text((18, 18), "Bisync.", fill=WHITE, font=font(14, True))
    tw = d.textlength("Bisync.", font=font(14, True))
    d.text((18 + tw, 18), "cloud", fill=ORANGE, font=font(14, True))
    y = 70
    for label in NAV_ITEMS:
        box = [12, y, panel_w - 12, y + 34]
        if label == active:
            rounded_rect(d, box, 6, (*ORANGE, 255))
            d.text((24, y + 9), label, fill=WHITE, font=font(12, True))
        else:
            d.text((24, y + 9), label, fill=(255, 255, 255, 150), font=font(12))
        y += 42
    out = Image.alpha_composite(base.convert("RGBA"), overlay)
    out = Image.alpha_composite(out, panel)
    return out.convert("RGB")


def draw_home_content(d: ImageDraw.ImageDraw, header_h: int) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    d.text((24, header_h + 18), "Home", fill=SADDLE, font=font(18, True))
    d.text(
        (24, header_h + 42),
        "Open a module to continue — only enabled modules are available.",
        fill=MUTED,
        font=font(11),
    )
    cols = 2
    tile_w, tile_h = 440, 150
    gap = 16
    ox, oy = 24, header_h + 70
    for i, (code, name, accent) in enumerate(MODULE_TILES):
        col, row = i % cols, i // cols
        x = ox + col * (tile_w + gap)
        y = oy + row * (tile_h + gap)
        rounded_rect(d, [x, y, x + tile_w, y + tile_h], 12, CARD, outline=(42, 33, 24, 28), width=1)
        # wash
        wash = Image.new("RGBA", (tile_w, tile_h), (0, 0, 0, 0))
        wd = ImageDraw.Draw(wash)
        for yy in range(tile_h):
            a = int(28 * (1 - yy / tile_h))
            wd.line([(0, yy), (tile_w, yy)], fill=(*accent, a))
        # paste wash via temporary composite later — approximate with light rect
        d.rectangle([x, y, x + tile_w, y + 8], fill=(*accent, 40) if False else SOFT)
        d.text((x + 16, y + 16), code, fill=accent, font=font(10, True))
        d.text((x + 16, y + 36), name, fill=SADDLE, font=font(15, True))
        d.text((x + 16, y + 62), "Open module →", fill=ORANGE, font=font(11, True))
        # graphic stub
        rounded_rect(d, [x + tile_w - 120, y + 24, x + tile_w - 16, y + tile_h - 24], 8, (*accent, 35) if False else SOFT)
        d.rectangle(
            [x + tile_w - 120, y + 24, x + tile_w - 16, y + tile_h - 24],
            fill=(accent[0], accent[1], accent[2]),
        )
        # lighten by overlaying white-ish is hard in RGB; draw accent at low visual weight via smaller bars
        d.rectangle(
            [x + tile_w - 120, y + 24, x + tile_w - 16, y + tile_h - 24],
            fill=SOFT,
        )
        for bi, bh in enumerate([40, 55, 70, 48]):
            bx = x + tile_w - 108 + bi * 22
            by = y + tile_h - 36 - bh // 2
            d.rectangle([bx, by, bx + 14, y + tile_h - 36], fill=accent)


def draw_module_bar(d: ImageDraw.ImageDraw, y: int, pills: list[str], active: str) -> int:
    d.rectangle([0, y, W, y + 44], fill=CARD)
    d.line([(0, y + 43), (W, y + 43)], fill=(42, 33, 24, 25), width=1)
    x = 16
    for pill in pills:
        tw = int(d.textlength(pill, font=font(11, True))) + 20
        if pill == active:
            rounded_rect(d, [x, y + 8, x + tw, y + 34], 14, ORANGE)
            d.text((x + 10, y + 14), pill, fill=WHITE, font=font(11, True))
        else:
            rounded_rect(d, [x, y + 8, x + tw, y + 34], 14, SOFT, outline=(42, 33, 24, 30))
            d.text((x + 10, y + 14), pill, fill=MUTED, font=font(11))
        x += tw + 8
    return y + 44


def draw_table(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, headers: list[str], rows: list[list[str]]) -> None:
    rounded_rect(d, [x, y, x + w, y + h], 8, CARD, outline=(42, 33, 24, 28), width=1)
    row_h = 32
    d.rectangle([x, y, x + w, y + row_h], fill=SOFT)
    col_w = w / max(len(headers), 1)
    for i, head in enumerate(headers):
        d.text((x + 10 + i * col_w, y + 9), head, fill=MUTED, font=font(10, True))
    for r, row in enumerate(rows[:8]):
        yy = y + row_h * (r + 1)
        if yy + row_h > y + h:
            break
        if r % 2 == 1:
            d.rectangle([x, yy, x + w, yy + row_h], fill=(250, 248, 245))
        for i, cell in enumerate(row):
            d.text((x + 10 + i * col_w, yy + 9), cell[:22], fill=SADDLE, font=font(11))


def draw_login(d: ImageDraw.ImageDraw) -> None:
    # Brand landing wash
    for yy in range(H):
        t = yy / H
        r = int(42 + (253 - 42) * t * 0.15)
        g = int(33 + (232 - 33) * t * 0.12)
        b = int(24 + (216 - 24) * t * 0.1)
        d.line([(0, yy), (W, yy)], fill=(min(255, r + 180), min(255, g + 180), min(255, b + 180)))
    d.rectangle([0, 0, W, H], fill=(253, 248, 242))
    # Left brand panel
    d.rectangle([0, 0, int(W * 0.42), H], fill=SADDLE)
    if LOGO_PATH.exists():
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            logo.thumbnail((120, 120))
            # caller composites — draw orange mark instead if paste awkward
        except Exception:
            pass
    d.ellipse([70, 120, 150, 200], fill=ORANGE)
    d.text((88, 148), "B", fill=WHITE, font=font(36, True))
    d.text((70, 220), "Bisync.cloud", fill=WHITE, font=font(22, True))
    d.text((70, 252), "Restaurant operations platform", fill=(255, 255, 255, 160), font=font(12))
    # Sign-in card
    cx0, cy0 = int(W * 0.5), int(H * 0.18)
    rounded_rect(d, [cx0, cy0, cx0 + 380, cy0 + 320], 12, WHITE, outline=(42, 33, 24, 30), width=1)
    d.text((cx0 + 28, cy0 + 28), "Sign in", fill=SADDLE, font=font(20, True))
    d.text((cx0 + 28, cy0 + 60), "Use your company account email and password.", fill=MUTED, font=font(11))
    rounded_rect(d, [cx0 + 28, cy0 + 100, cx0 + 352, cy0 + 136], 6, SOFT, outline=(42, 33, 24, 35))
    d.text((cx0 + 40, cy0 + 110), "Email", fill=MUTED, font=font(11))
    rounded_rect(d, [cx0 + 28, cy0 + 152, cx0 + 352, cy0 + 188], 6, SOFT, outline=(42, 33, 24, 35))
    d.text((cx0 + 40, cy0 + 162), "Password", fill=MUTED, font=font(11))
    rounded_rect(d, [cx0 + 28, cy0 + 220, cx0 + 352, cy0 + 258], 8, ORANGE)
    d.text((cx0 + 160, cy0 + 232), "Sign in", fill=WHITE, font=font(13, True))


def draw_rms(d: ImageDraw.ImageDraw, task: dict, header_h: int) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    y = draw_module_bar(
        d,
        header_h,
        ["Operation", "Component", "Vendors", "Products", "Sales", "Reports"],
        "Operation" if "rms-" in task["id"] else "Component",
    )
    title = page_title(task)
    d.text((24, y + 16), title, fill=SADDLE, font=font(16, True))
    rounded_rect(d, [W - 160, y + 12, W - 24, y + 40], 6, ORANGE)
    d.text((W - 148, y + 18), "+ New", fill=WHITE, font=font(11, True))
    draw_table(
        d,
        24,
        y + 52,
        W - 48,
        H - y - 70,
        ["Document", "Vendor / Outlet", "Status", "Amount"],
        [
            ["PO-1042", "Central Kitchen", "Open", "$1,240.00"],
            ["PO-1041", "Fresh Farm Co", "Received", "$860.50"],
            ["PO-1040", "Dairy Supply", "Draft", "$320.00"],
            ["PO-1039", "Beverage Hub", "Closed", "$2,110.25"],
            ["PO-1038", "Central Kitchen", "Open", "$540.00"],
        ],
    )


def draw_pos(d: ImageDraw.ImageDraw, task: dict, header_h: int, floor: bool = False) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    y = draw_module_bar(
        d,
        header_h,
        ["POS Menu", "Modifier Group", "Promotion Scheduler", "POS Config", "Devices"],
        "POS Menu" if "menu" in task["id"] or "take" in task["id"] else "POS Config",
    )
    if floor:
        d.text((24, y + 14), "POS Floor · Take order", fill=SADDLE, font=font(16, True))
        # Tables grid
        for i in range(8):
            col, row = i % 4, i // 4
            x = 24 + col * 230
            ty = y + 50 + row * 160
            color = ORANGE if i in (1, 4) else (42, 122, 106) if i == 2 else SOFT
            text_c = WHITE if i in (1, 2, 4) else SADDLE
            rounded_rect(d, [x, ty, x + 210, ty + 140], 10, color if i in (1, 2, 4) else CARD, outline=(42, 33, 24, 30))
            if i not in (1, 2, 4):
                d.rectangle([x, ty, x + 210, ty + 140], fill=SOFT)
            d.text((x + 16, ty + 20), f"T{i + 1}", fill=text_c if i in (1, 2, 4) else SADDLE, font=font(18, True))
            d.text((x + 16, ty + 50), "4 pax" if i in (1, 4) else "Open", fill=text_c if i in (1, 2, 4) else MUTED, font=font(11))
        return
    d.text((24, y + 14), page_title(task), fill=SADDLE, font=font(16, True))
    draw_table(
        d,
        24,
        y + 48,
        W - 48,
        H - y - 66,
        ["Code", "Name", "Group", "Price", "Active"],
        [
            ["BURG", "Classic Burger", "Mains", "$12.00", "Yes"],
            ["BEER", "Craft Beer", "Beer", "$8.00", "Yes"],
            ["Fries", "Shoestring Fries", "Sides", "$5.50", "Yes"],
            ["LATTE", "Cafe Latte", "Coffee", "$4.80", "Yes"],
            ["CAKE", "Cheesecake", "Dessert", "$7.20", "Yes"],
        ],
    )


def draw_hr(d: ImageDraw.ImageDraw, task: dict, header_h: int) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    y = draw_module_bar(
        d,
        header_h,
        ["Directory", "Attendance", "Leave", "Schedule", "Team", "HR Config"],
        "Directory",
    )
    d.text((24, y + 14), page_title(task), fill=SADDLE, font=font(16, True))
    draw_table(
        d,
        24,
        y + 48,
        W - 48,
        H - y - 66,
        ["Employee", "Department", "Position", "Status"],
        [
            ["Alex Tan", "FOH", "Captain", "Active"],
            ["Mei Wong", "Kitchen", "Chef", "Active"],
            ["Raj Kumar", "Bar", "Bartender", "Active"],
            ["Sara Lim", "FOH", "Server", "Active"],
            ["Jon Lee", "Kitchen", "Prep", "On leave"],
        ],
    )


def draw_accounting(d: ImageDraw.ImageDraw, task: dict, header_h: int) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    d.text((24, header_h + 18), page_title(task), fill=SADDLE, font=font(16, True))
    cards = [
        ("Gross pay", "$48,220"),
        ("Deductions", "$6,140"),
        ("Net pay", "$42,080"),
    ]
    for i, (label, value) in enumerate(cards):
        x = 24 + i * 300
        rounded_rect(d, [x, header_h + 56, x + 280, header_h + 140], 10, CARD, outline=(42, 33, 24, 28))
        d.text((x + 16, header_h + 70), label, fill=MUTED, font=font(11))
        d.text((x + 16, header_h + 96), value, fill=SADDLE, font=font(20, True))
    draw_table(
        d,
        24,
        header_h + 160,
        W - 48,
        H - header_h - 180,
        ["Employee", "Period", "Net", "Status"],
        [
            ["Alex Tan", "Jul 2026", "$3,240", "Ready"],
            ["Mei Wong", "Jul 2026", "$4,100", "Ready"],
            ["Raj Kumar", "Jul 2026", "$2,980", "Draft"],
        ],
    )


def draw_system(d: ImageDraw.ImageDraw, task: dict, header_h: int) -> None:
    d.rectangle([0, header_h, W, H], fill=BG)
    y = draw_module_bar(
        d,
        header_h,
        ["Companies", "Locations", "Access Control", "Audit Trail"],
        "Companies",
    )
    d.text((24, y + 14), page_title(task), fill=SADDLE, font=font(16, True))
    draw_table(
        d,
        24,
        y + 48,
        W - 48,
        H - y - 66,
        ["Name", "Code", "Locations", "Status"],
        [
            ["Weissbrau Group", "WEIS", "4", "Active"],
            ["Demo Company", "DEMO", "2", "Active"],
            ["Sandbox Co", "SAND", "1", "Active"],
        ],
    )


def draw_bisync101_overlay(base: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 110))
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    # Bottom sheet-ish workspace
    rounded_rect(d, [40, 40, W - 40, H - 40], 12, (*SADDLE, 255))
    d.text((60, 58), "Bisync101", fill=WHITE, font=font(16, True))
    d.text((60, 82), "User guide & wiki", fill=(255, 255, 255, 140), font=font(11))
    # Module list
    mods = ["Getting Started", "System Config", "RMS Orders", "POS", "HR", "Accounting"]
    for i, m in enumerate(mods):
        yy = 120 + i * 36
        if i == 0:
            rounded_rect(d, [56, yy, 240, yy + 30], 6, (*ORANGE, 255))
            d.text((68, yy + 7), m, fill=WHITE, font=font(11, True))
        else:
            d.text((68, yy + 7), m, fill=(255, 255, 255, 160), font=font(11))
    # Clip preview
    rounded_rect(d, [260, 120, W - 60, H - 70], 8, (26, 20, 16, 255))
    d.text((280, 140), "Screen capture", fill=(255, 255, 255, 180), font=font(10, True))
    rounded_rect(d, [280, 170, W - 80, 360], 6, (247, 244, 239, 255))
    d.text((300, 220), "Play a task clip", fill=SADDLE, font=font(14, True))
    out = Image.alpha_composite(base.convert("RGBA"), overlay)
    out = Image.alpha_composite(out, panel)
    return out.convert("RGB")


def draw_platform_screen(task: dict) -> Image.Image:
    kind = screen_kind(task["id"])
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    header_h = int(H * 0.11)

    if kind == "login":
        draw_login(d)
        return img

    draw_header(d, page_title(task), show_101=True)

    if kind in ("home", "home-sidebar", "home-101"):
        draw_home_content(d, header_h)
        if kind == "home-sidebar":
            img = draw_sidebar(img, "Home")
        elif kind == "home-101":
            img = draw_bisync101_overlay(img)
        return img

    if kind == "rms":
        draw_rms(d, task, header_h)
    elif kind == "pos":
        draw_pos(d, task, header_h, floor=False)
    elif kind == "pos-floor":
        draw_pos(d, task, header_h, floor=True)
    elif kind == "hr":
        draw_hr(d, task, header_h)
    elif kind == "accounting":
        draw_accounting(d, task, header_h)
    elif kind == "system":
        draw_system(d, task, header_h)
    else:
        draw_home_content(d, header_h)
    return img


def draw_hotspot(img: Image.Image, hotspot: dict, t: float) -> Image.Image:
    base = img.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    hx = int(W * hotspot["x"] / 100)
    hy = int(H * hotspot["y"] / 100)
    hw = max(24, int(W * hotspot["w"] / 100))
    hh = max(18, int(H * hotspot["h"] / 100))
    pulse = 0.35 + 0.25 * abs((t * 3) % 2 - 1)
    od.rectangle(
        [hx, hy, hx + hw, hy + hh],
        outline=(*ORANGE, 255),
        width=3,
        fill=(243, 112, 33, int(30 + pulse * 50)),
    )
    label = hotspot.get("label") or ""
    if label:
        lw = int(od.textlength(label, font=font(11, True))) + 16
        ly = max(8, hy - 24)
        od.rounded_rectangle([hx, ly, hx + lw, ly + 20], radius=4, fill=(*ORANGE, 255))
        od.text((hx + 8, ly + 4), label, fill=WHITE, font=font(11, True))
    # Cursor
    cx = hx + int(hw * (0.25 + 0.5 * ((t * 1.4) % 1)))
    cy = hy + int(hh * 0.55)
    od.polygon(
        [
            (cx, cy),
            (cx, cy + 18),
            (cx + 5, cy + 14),
            (cx + 10, cy + 22),
            (cx + 13, cy + 20),
            (cx + 8, cy + 12),
            (cx + 14, cy + 12),
        ],
        fill=WHITE,
        outline=(17, 17, 17, 255),
    )
    return Image.alpha_composite(base, overlay).convert("RGB")


def draw_caption(img: Image.Image, step_index: int, step_title: str) -> Image.Image:
    base = img.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([0, int(H * 0.88), W, H], fill=(17, 17, 17, 210))
    od.text((20, int(H * 0.905)), f"STEP {step_index + 1}", fill=ORANGE, font=font(10, True))
    od.text((100, int(H * 0.9)), step_title[:72], fill=WHITE, font=font(14, True))
    od.text((20, 8), "Bisync101 · platform screen", fill=(220, 220, 220, 200), font=font(10))
    return Image.alpha_composite(base, overlay).convert("RGB")


def draw_frame(task: dict, step_index: int, t: float) -> Image.Image:
    screen = draw_platform_screen(task)
    steps = task["steps"] or [task["title"]]
    step_title = steps[min(step_index, len(steps) - 1)]
    hotspots = task.get("hotspots") or []
    hotspot = hotspots[min(step_index, len(hotspots) - 1)] if hotspots else None
    if hotspot:
        screen = draw_hotspot(screen, hotspot, t)
    return draw_caption(screen, step_index, step_title)


def render_clip(task: dict, out_path: Path) -> None:
    steps = task["steps"] or [task["title"]]
    frames_dir = Path(tempfile.mkdtemp(prefix="bisync101-"))
    try:
        frame_i = 0
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
            "700k",
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
    print(f"Generating {len(tasks)} platform-screen clips → {OUT_DIR}")
    for task in tasks:
        out = OUT_DIR / task["clipFile"]
        print(f"  {task['clipFile']} — {task['title']} [{screen_kind(task['id'])}]")
        render_clip(task, out)
    (OUT_DIR / "README.md").write_text(
        "# Bisync101 clips\n\n"
        "Short silent WebM captures that mirror Bisync.cloud platform screens "
        "(header, module chrome, and task hotspots).\n"
        "Regenerate with `python3 scripts/generate-bisync101-clips.py`.\n"
        "Replace any file with a live screen recording of the same name to upgrade fidelity.\n",
        encoding="utf-8",
    )
    print("Done.")


if __name__ == "__main__":
    main()
