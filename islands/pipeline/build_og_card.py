"""Build the OG / social card for the islands page.

Outputs (1200×630):
  assets/og-card.jpg  — static frame
  assets/og-card.mp4  — animated card
  assets/og-card.gif  — animated GIF

Layout: title on the left, Namyit Island timelapse on the right.

Usage:  python pipeline/build_og_card.py
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SOURCE_VIDEO = ASSETS / "videos" / "namyit-island.mp4"

OUT_JPG = ASSETS / "og-card.jpg"
OUT_MP4 = ASSETS / "og-card.mp4"
OUT_GIF = ASSETS / "og-card.gif"
TMP_OVERLAY = Path("/tmp/og-overlay.png")
TMP_PALETTE = Path("/tmp/og-palette.png")

W, H = 1200, 630
LEFT_W = 600

BG = (1, 5, 8, 255)           # #010508 — sampled from deep SCS water
BG_HEX = "0x010508"           # ffmpeg form
FG = (232, 232, 232, 255)     # #e8e8e8
ACCENT = (255, 176, 74, 255)  # #ffb04a

# Right pane: place the 500×500 timelapse scaled up to 600×600, centered
# vertically inside the 630-tall canvas.
RIGHT_X = LEFT_W
RIGHT_Y = (H - 600) // 2
RIGHT_SIZE = 600

# Each timelapse runs from 2019-01 at 10 fps (1 frame per month). Show
# 2020-06 → 2025-12: skip first 17 frames, then play 67 frames = 6.7s.
TRIM_START_S = 1.7
DURATION_S = 6.7

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def load_font(size: int, weight_index: int = 1) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size, index=weight_index)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def text_size(font: ImageFont.FreeTypeFont, s: str) -> tuple[int, int]:
    bbox = font.getbbox(s)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def render_overlay() -> None:
    """Render the 1200×630 overlay: solid left panel with the title; right
    side fully transparent so the video shows through."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, 0), (LEFT_W, H)], fill=BG)

    line1 = "Islands of the"
    line2 = "South China Sea"

    font = load_font(72, weight_index=1)  # Helvetica Bold
    pad_x = 80
    line_gap = 14

    w1, h1 = text_size(font, line1)
    w2, h2 = text_size(font, line2)
    total_h = h1 + line_gap + h2
    y0 = (H - total_h) // 2

    draw.text((pad_x, y0), line1, font=font, fill=FG)
    draw.text((pad_x, y0 + h1 + line_gap), line2, font=font, fill=ACCENT)

    img.save(TMP_OVERLAY)


def build_mp4() -> None:
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{TRIM_START_S}",
        "-stream_loop", "-1",
        "-i", str(SOURCE_VIDEO),
        "-loop", "1",
        "-i", str(TMP_OVERLAY),
        "-filter_complex",
        (
            f"color=c={BG_HEX}:s={W}x{H}:r=10:d={DURATION_S}[bg];"
            f"[0:v]scale={RIGHT_SIZE}:{RIGHT_SIZE},setsar=1[vid];"
            f"[bg][vid]overlay={RIGHT_X}:{RIGHT_Y}:shortest=0[withvid];"
            f"[withvid][1:v]overlay=0:0:shortest=1[final]"
        ),
        "-map", "[final]",
        "-t", f"{DURATION_S}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "slow",
        "-crf", "20",
        "-movflags", "+faststart",
        "-an",
        str(OUT_MP4),
    ]
    subprocess.run(cmd, check=True)


def build_jpg() -> None:
    """Render the still directly from a source frame + overlay so the JPG
    avoids the MP4's lossy round-trip. Crisper text, cleaner reef edges.
    Picks the last frame of the trimmed window so the still matches the
    final frame of the animated card."""
    tmp_frame = Path("/tmp/og-source-frame.png")
    last_frame_t = TRIM_START_S + DURATION_S - 0.05
    subprocess.run([
        "ffmpeg", "-y",
        "-ss", f"{last_frame_t}",
        "-i", str(SOURCE_VIDEO),
        "-frames:v", "1",
        "-c:v", "png",
        str(tmp_frame),
    ], check=True)

    canvas = Image.new("RGB", (W, H), BG[:3])
    frame = Image.open(tmp_frame).convert("RGB").resize(
        (RIGHT_SIZE, RIGHT_SIZE), Image.LANCZOS
    )
    canvas.paste(frame, (RIGHT_X, RIGHT_Y))

    overlay = Image.open(TMP_OVERLAY).convert("RGBA")
    canvas.paste(overlay, (0, 0), overlay)

    canvas.save(OUT_JPG, "JPEG", quality=95, subsampling=0, optimize=True)


def build_gif() -> None:
    # Smaller dimensions + lower fps keeps the GIF size reasonable. Social
    # cards never display at native resolution, so the scaledown is invisible.
    gif_filter = "fps=8,scale=800:420:flags=lanczos"
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(OUT_MP4),
        "-vf", f"{gif_filter},palettegen=stats_mode=diff",
        str(TMP_PALETTE),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(OUT_MP4),
        "-i", str(TMP_PALETTE),
        "-filter_complex", f"{gif_filter}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5",
        str(OUT_GIF),
    ], check=True)


def main() -> None:
    print(f"rendering overlay -> {TMP_OVERLAY}")
    render_overlay()
    print(f"building mp4      -> {OUT_MP4}")
    build_mp4()
    print(f"building jpg      -> {OUT_JPG}")
    build_jpg()
    print(f"building gif      -> {OUT_GIF}")
    build_gif()
    for p in (OUT_JPG, OUT_MP4, OUT_GIF):
        print(f"  {p}  ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
